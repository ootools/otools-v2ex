import { ref } from 'vue';
import { invoke, isOtoolsPluginRuntime } from 'otools-plugin-sdk/runtime';
import { readCache, writeCache } from './cache';
import type { V2exNode, V2exReply, V2exTopic } from './types';

const API_BASE = 'https://www.v2ex.com/api';
const HOST_HTTP_COMMAND = 'otools_host_http_send';
const REQUEST_GAP_MS = 180;

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

const TTL = {
  nodes: 24 * HOUR,
  latest: 2 * MINUTE,
  hot: 5 * MINUTE,
  nodeTopics: 3 * MINUTE,
  topic: 5 * MINUTE,
  replies: 3 * MINUTE,
};

export type V2exErrorKind = 'network' | 'rate' | 'notfound' | 'http' | 'parse';

export class V2exApiError extends Error {
  readonly kind: V2exErrorKind;
  readonly status?: number;
  readonly detail?: string;

  constructor(kind: V2exErrorKind, message: string, options: { status?: number; detail?: string } = {}) {
    super(message);
    this.name = 'V2exApiError';
    this.kind = kind;
    this.status = options.status;
    this.detail = options.detail;
  }
}

export const rateRemaining = ref<number | null>(null);
export const rateLimit = ref<number | null>(null);

interface HttpResult {
  status: number;
  text: string;
  headers: Record<string, string>;
}

interface HostHttpResponse {
  status: number;
  body_text?: string | null;
  headers?: Array<{ key: string; value: string }>;
}

const devMockEnabled = (): boolean => {
  if (!import.meta.env.DEV || typeof window === 'undefined') return false;
  try {
    return new URLSearchParams(window.location.search).has('mock');
  } catch {
    return false;
  }
};

const canUseHostHttp = (): boolean => {
  if (typeof window === 'undefined') return false;
  const host = window as unknown as { __TAURI_INTERNALS__?: unknown };
  return Boolean(host.__TAURI_INTERNALS__) || isOtoolsPluginRuntime();
};

const toHeaderMap = (items: Array<{ key: string; value: string }> | undefined): Record<string, string> => {
  const headers: Record<string, string> = {};
  for (const item of items ?? []) {
    if (!item || typeof item.key !== 'string') continue;
    headers[item.key.toLowerCase()] = String(item.value ?? '');
  }
  return headers;
};

const trackRateLimit = (headers: Record<string, string>): void => {
  const remaining = Number(headers['x-rate-limit-remaining']);
  const limit = Number(headers['x-rate-limit-limit']);
  if (Number.isFinite(remaining) && remaining >= 0) rateRemaining.value = remaining;
  if (Number.isFinite(limit) && limit > 0) rateLimit.value = limit;
};

const hostGet = async (url: string): Promise<HttpResult> => {
  const response = await invoke<HostHttpResponse>(HOST_HTTP_COMMAND, {
    request: {
      id: '',
      name: 'v2ex',
      method: 'GET',
      url,
      headers: [
        { key: 'Accept', value: 'application/json', enabled: true },
        { key: 'User-Agent', value: 'OTools-V2EX/0.1', enabled: true },
      ],
      cookies: [],
      params: [],
      body_type: 'none',
      body: '',
      timeout_secs: 20,
      follow_redirects: true,
    },
  });

  return {
    status: Number(response?.status ?? 0),
    text: String(response?.body_text ?? ''),
    headers: toHeaderMap(response?.headers),
  };
};

const browserGet = async (url: string): Promise<HttpResult> => {
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  const text = await response.text();
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });
  return { status: response.status, text, headers };
};

let requestChain: Promise<unknown> = Promise.resolve();
let lastRequestAt = 0;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const enqueue = <T>(task: () => Promise<T>): Promise<T> => {
  const run = requestChain.then(task, task);
  requestChain = run.catch(() => undefined);
  return run;
};

const throttle = async (): Promise<void> => {
  const wait = Math.max(0, lastRequestAt + REQUEST_GAP_MS - Date.now());
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
};

const performRequest = async (url: string): Promise<HttpResult> => {
  if (devMockEnabled()) {
    const { resolveMock } = await import('./mock/data');
    const mocked = resolveMock(url);
    if (mocked !== null) {
      return { status: 200, text: mocked, headers: {} };
    }
  }

  if (canUseHostHttp()) {
    try {
      return await hostGet(url);
    } catch (error) {
      // 宿主命令不可用（旧版本）时回退到 webview fetch；跨域失败会落到 network 错误。
      if (import.meta.env.DEV) {
        console.warn('[v2ex] host http failed, falling back to fetch', error);
      }
    }
  }

  return browserGet(url);
};

const getJson = async <T>(url: string, ttlMs: number, force = false): Promise<T> => {
  if (!force) {
    const cached = readCache<T>(url, ttlMs);
    if (cached !== null) return cached;
  }

  return enqueue(async () => {
    if (!force) {
      const cached = readCache<T>(url, ttlMs);
      if (cached !== null) return cached;
    }

    await throttle();

    let result: HttpResult;
    try {
      result = await performRequest(url);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new V2exApiError('network', 'network request failed', { detail: message });
    }

    trackRateLimit(result.headers);

    if (result.status === 403 || result.status === 429) {
      throw new V2exApiError('rate', 'rate limit exceeded', { status: result.status });
    }
    if (result.status === 404) {
      throw new V2exApiError('notfound', 'resource not found', { status: 404 });
    }
    if (!result.status || result.status >= 400) {
      throw new V2exApiError('http', `unexpected status ${result.status}`, { status: result.status });
    }

    const text = result.text.trim();
    if (!text) {
      throw new V2exApiError('parse', 'empty response');
    }

    try {
      const data = JSON.parse(text) as T;
      writeCache(url, data);
      return data;
    } catch {
      // 配额用尽或节点维护时 V2EX 会返回 HTML 错误页。
      throw new V2exApiError('parse', 'response is not json', {
        detail: text.slice(0, 160),
      });
    }
  });
};

export function fetchNodes(force = false): Promise<V2exNode[]> {
  return getJson<V2exNode[]>(`${API_BASE}/nodes/all.json`, TTL.nodes, force);
}

export function fetchLatestTopics(force = false): Promise<V2exTopic[]> {
  return getJson<V2exTopic[]>(`${API_BASE}/topics/latest.json`, TTL.latest, force);
}

export function fetchHotTopics(force = false): Promise<V2exTopic[]> {
  return getJson<V2exTopic[]>(`${API_BASE}/topics/hot.json`, TTL.hot, force);
}

export function fetchNodeTopics(nodeName: string, force = false): Promise<V2exTopic[]> {
  const query = new URLSearchParams({ node_name: nodeName });
  return getJson<V2exTopic[]>(`${API_BASE}/topics/show.json?${query.toString()}`, TTL.nodeTopics, force);
}

export async function fetchTopic(topicId: number, force = false): Promise<V2exTopic> {
  const query = new URLSearchParams({ id: String(topicId) });
  const topics = await getJson<V2exTopic[]>(`${API_BASE}/topics/show.json?${query.toString()}`, TTL.topic, force);
  const topic = Array.isArray(topics) ? topics[0] : null;
  if (!topic) {
    throw new V2exApiError('notfound', 'topic not found', { status: 404 });
  }
  return topic;
}

export function fetchReplies(topicId: number, force = false): Promise<V2exReply[]> {
  const query = new URLSearchParams({ topic_id: String(topicId) });
  return getJson<V2exReply[]>(`${API_BASE}/replies/show.json?${query.toString()}`, TTL.replies, force);
}
