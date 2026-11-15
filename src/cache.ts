const CACHE_PREFIX = 'otools-v2ex:cache:';
const CACHE_INDEX_KEY = 'otools-v2ex:cache-index';
const MAX_CACHE_ENTRIES = 80;

interface CacheEntry<T> {
  savedAt: number;
  value: T;
}

const storage = (): Storage | null => {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
};

const readIndex = (): string[] => {
  const store = storage();
  if (!store) return [];
  try {
    const parsed = JSON.parse(store.getItem(CACHE_INDEX_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((key): key is string => typeof key === 'string') : [];
  } catch {
    return [];
  }
};

const writeIndex = (keys: string[]) => {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(CACHE_INDEX_KEY, JSON.stringify(keys.slice(-MAX_CACHE_ENTRIES)));
  } catch {
    // 配额写满时放弃索引维护，缓存仍可命中。
  }
};

export function readCache<T>(key: string, ttlMs: number): T | null {
  const store = storage();
  if (!store || ttlMs <= 0) return null;
  try {
    const raw = store.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (!entry || typeof entry.savedAt !== 'number') return null;
    if (Date.now() - entry.savedAt > ttlMs) {
      store.removeItem(CACHE_PREFIX + key);
      return null;
    }
    return entry.value;
  } catch {
    return null;
  }
}

export function writeCache<T>(key: string, value: T): void {
  const store = storage();
  if (!store) return;
  try {
    const entry: CacheEntry<T> = { savedAt: Date.now(), value };
    store.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
    const index = readIndex().filter((item) => item !== key);
    index.push(key);
    if (index.length > MAX_CACHE_ENTRIES) {
      for (const stale of index.splice(0, index.length - MAX_CACHE_ENTRIES)) {
        store.removeItem(CACHE_PREFIX + stale);
      }
    }
    writeIndex(index);
  } catch {
    // 存储不可用（隐私模式 / 配额满）时静默降级为纯内存请求。
  }
}

export function clearCache(): void {
  const store = storage();
  if (!store) return;
  try {
    for (const key of readIndex()) {
      store.removeItem(CACHE_PREFIX + key);
    }
    store.removeItem(CACHE_INDEX_KEY);
  } catch {
    // ignore
  }
}
