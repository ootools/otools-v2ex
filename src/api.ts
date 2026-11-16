import { ref } from 'vue';
import { invoke, isOtoolsPluginRuntime } from 'otools-plugin-sdk/runtime';
import { readCache, writeCache } from './cache';
import { getToken, hasToken } from './token';
import type {
  V2exMember,
  V2exNode,
  V2exNotification,
  V2exReply,
  V2exTokenInfo,
  V2exTopic,
} from './types';

const API_BASE = 'https://www.v2ex.com/api';
/** API 2.0 Beta：所有接口需要 `Authorization: Bearer <Personal Access Token>`。 */
const API_V2_BASE = 'https://www.v2ex.com/api/v2';
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
  member: 10 * MINUTE,
  /** 通知必须实时：配合轮询使用，不落缓存，避免删掉的那条又冒出来。 */
  notifications: 0,
};

export type V2exErrorKind = 'network' | 'rate' | 'auth' | 'notfound' | 'http' | 'parse';

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

type HttpMethod = 'GET' | 'DELETE';

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

interface RequestOptions {
  method?: HttpMethod;
  /** 附带 `Authorization: Bearer`（需要已登录）。 */
  auth?: boolean;
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

const buildHeaders = (options: RequestOptions): Array<{ key: string; value: string; enabled: boolean }> => {
  const headers = [
    { key: 'Accept', value: 'application/json', enabled: true },
    { key: 'User-Agent', value: 'OTools-V2EX/0.2', enabled: true },
  ];
  if (options.auth) {
    const token = getToken();
    if (token) headers.push({ key: 'Authorization', value: `Bearer ${token}`, enabled: true });
  }
  return headers;
};

const hostRequest = async (url: string, options: RequestOptions): Promise<HttpResult> => {
  const response = await invoke<HostHttpResponse>(HOST_HTTP_COMMAND, {
    request: {
      id: '',
      name: 'v2ex',
      method: options.method ?? 'GET',
      url,
      headers: buildHeaders(options),
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

const browserRequest = async (url: string, options: RequestOptions): Promise<HttpResult> => {
  const headers: Record<string, string> = {};
  for (const header of buildHeaders(options)) {
    if (header.enabled) headers[header.key] = header.value;
  }

  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers,
    cache: 'no-store',
  });
  const text = await response.text();
  const responseHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    responseHeaders[key.toLowerCase()] = value;
  });
  return { status: response.status, text, headers: responseHeaders };
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

const performRequest = async (url: string, options: RequestOptions): Promise<HttpResult> => {
  if (devMockEnabled()) {
    const { resolveMock } = await import('./mock/data');
    const mocked = resolveMock(url, {
      method: options.method ?? 'GET',
      auth: Boolean(options.auth && hasToken()),
      token: getToken(),
    });
    if (mocked !== null) {
      return { status: mocked.status, text: mocked.body, headers: {} };
    }
  }

  if (canUseHostHttp()) {
    try {
      return await hostRequest(url, options);
    } catch (error) {
      // 宿主命令不可用（旧版本）时回退到 webview fetch；跨域失败会落到 network 错误。
      if (import.meta.env.DEV) {
        console.warn('[v2ex] host http failed, falling back to fetch', error);
      }
    }
  }

  return browserRequest(url, options);
};

const assertStatus = (result: HttpResult): void => {
  if (result.status === 401) {
    throw new V2exApiError('auth', 'token is invalid or expired', { status: 401 });
  }
  if (result.status === 403 || result.status === 429) {
    throw new V2exApiError('rate', 'rate limit exceeded', { status: result.status });
  }
  if (result.status === 404) {
    throw new V2exApiError('notfound', 'resource not found', { status: 404 });
  }
  if (!result.status || result.status >= 400) {
    throw new V2exApiError('http', `unexpected status ${result.status}`, { status: result.status });
  }
};

/**
 * API 2.0 的响应统一包在 `{ success, result }` 里；success 为 false 时
 * `message` 是服务端的原因（多半是 token 无效或额度用尽）。
 */
const unwrapV2 = <T>(payload: unknown): T => {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const record = payload as { success?: unknown; message?: unknown; result?: unknown };
    if (record.success === false) {
      throw new V2exApiError('auth', String(record.message ?? 'api v2 returned success=false'));
    }
    if ('result' in record) return record.result as T;
  }
  return payload as T;
};

const getJson = async <T>(url: string, ttlMs: number, options: RequestOptions & { force?: boolean } = {}): Promise<T> => {
  const force = Boolean(options.force);

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
      result = await performRequest(url, options);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new V2exApiError('network', 'network request failed', { detail: message });
    }

    trackRateLimit(result.headers);
    assertStatus(result);

    const text = result.text.trim();
    if (!text) {
      throw new V2exApiError('parse', 'empty response');
    }

    let data: T;
    try {
      data = options.auth ? unwrapV2<T>(JSON.parse(text)) : (JSON.parse(text) as T);
    } catch (error) {
      if (error instanceof V2exApiError) throw error;
      // 配额用尽或节点维护时 V2EX 会返回 HTML 错误页。
      throw new V2exApiError('parse', 'response is not json', {
        detail: text.slice(0, 160),
      });
    }

    if (ttlMs > 0) writeCache(url, data);
    return data;  });
};

/** 发送不关心响应体的请求（DELETE），仅校验状态码。 */
const sendNoContent = async (url: string, options: RequestOptions): Promise<void> => {
  return enqueue(async () => {
    await throttle();

    let result: HttpResult;
    try {
      result = await performRequest(url, options);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new V2exApiError('network', 'network request failed', { detail: message });
    }

    trackRateLimit(result.headers);
    assertStatus(result);
  });
};

/**
 * 登录后优先走 API 2.0；未登录或 v2 失败（token 失效 / 接口变动）时回退 v1。
 * v1 是匿名公开接口，保证浏览功能永远可用。
 */
const withV2 = async <T>(v2: () => Promise<T>, v1: () => Promise<T>): Promise<T> => {
  if (!hasToken()) return v1();
  try {
    return await v2();
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[v2ex] api v2 failed, falling back to v1', error);
    }
    return v1();
  }
};

export function fetchNodes(force = false): Promise<V2exNode[]> {
  return getJson<V2exNode[]>(`${API_BASE}/nodes/all.json`, TTL.nodes, { force });
}

export function fetchLatestTopics(force = false): Promise<V2exTopic[]> {
  return getJson<V2exTopic[]>(`${API_BASE}/topics/latest.json`, TTL.latest, { force });
}

export function fetchHotTopics(force = false): Promise<V2exTopic[]> {
  return getJson<V2exTopic[]>(`${API_BASE}/topics/hot.json`, TTL.hot, { force });
}

const normalizeV2Reply = (reply: V2exReply, topicId: number): V2exReply => ({
  ...reply,
  topic_id: reply.topic_id ?? topicId,
});

export function fetchNodeTopics(nodeName: string, force = false): Promise<V2exTopic[]> {
  const query = new URLSearchParams({ node_name: nodeName });
  const v1 = () => getJson<V2exTopic[]>(`${API_BASE}/topics/show.json?${query.toString()}`, TTL.nodeTopics, { force });
  const v2 = () =>
    getJson<V2exTopic[]>(`${API_V2_BASE}/nodes/${encodeURIComponent(nodeName)}/topics`, TTL.nodeTopics, {
      force,
      auth: true,
    });

  return withV2(v2, v1).then((list) => (Array.isArray(list) ? list : []));
}

export async function fetchTopic(topicId: number, force = false): Promise<V2exTopic> {
  const query = new URLSearchParams({ id: String(topicId) });

  const v1 = async (): Promise<V2exTopic> => {
    const topics = await getJson<V2exTopic[]>(`${API_BASE}/topics/show.json?${query.toString()}`, TTL.topic, { force });
    const topic = Array.isArray(topics) ? topics[0] : null;
    if (!topic) {
      throw new V2exApiError('notfound', 'topic not found', { status: 404 });
    }
    return topic;
  };

  const v2 = async (): Promise<V2exTopic> => {
    const raw = await getJson<V2exTopic | V2exTopic[]>(`${API_V2_BASE}/topics/${topicId}`, TTL.topic, {
      force,
      auth: true,
    });
    const topic = Array.isArray(raw) ? raw[0] : raw;
    if (!topic || !topic.id) {
      throw new V2exApiError('notfound', 'topic not found', { status: 404 });
    }
    return topic;
  };

  return withV2(v2, v1);
}

export async function fetchReplies(topicId: number, force = false, page = 1): Promise<V2exReply[]> {
  const query = new URLSearchParams({ topic_id: String(topicId) });

  const v1 = async (): Promise<V2exReply[]> => {
    const replies = await getJson<V2exReply[]>(`${API_BASE}/replies/show.json?${query.toString()}`, TTL.replies, { force });
    return Array.isArray(replies) ? replies : [];
  };

  const v2 = async (): Promise<V2exReply[]> => {
    const url = `${API_V2_BASE}/topics/${topicId}/replies${page > 1 ? `?p=${page}` : ''}`;
    const replies = await getJson<V2exReply[]>(url, TTL.replies, { force, auth: true });
    return Array.isArray(replies) ? replies.map((reply) => normalizeV2Reply(reply, topicId)) : [];
  };

  return withV2(v2, v1);
}

/** 校验 token 并读取它的授权范围与有效期。 */
export function fetchTokenInfo(force = true): Promise<V2exTokenInfo> {
  return getJson<V2exTokenInfo>(`${API_V2_BASE}/token`, 0, { force, auth: true });
}

/** 当前 token 所属账号的资料。 */
export function fetchMyProfile(force = false): Promise<V2exMember> {
  return getJson<V2exMember>(`${API_V2_BASE}/member`, TTL.member, { force, auth: true });
}

export function fetchNotifications(page = 1, force = false): Promise<V2exNotification[]> {
  const url = `${API_V2_BASE}/notifications${page > 1 ? `?p=${page}` : ''}`;
  return getJson<V2exNotification[]>(url, TTL.notifications, { force, auth: true }).then((items) =>
    Array.isArray(items) ? items : [],
  );
}

export async function deleteNotification(id: number): Promise<void> {
  await sendNoContent(`${API_V2_BASE}/notifications/${id}`, { method: 'DELETE', auth: true });
}
