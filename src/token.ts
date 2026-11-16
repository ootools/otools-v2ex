/**
 * V2EX Personal Access Token 的本地存取。
 *
 * 只做「读 / 写 / 清除 + 响应式引用」这一件事，不依赖 api.ts，
 * 这样 api.ts 可以单向依赖本模块，auth.ts 再向上组合，避免循环引用。
 *
 * 存储位置是插件 webview 自己的 localStorage（同源、仅本机）。
 * token 可由用户在 https://www.v2ex.com/settings/tokens 随时撤销。
 */
import { ref } from 'vue';

const TOKEN_KEY = 'otools-v2ex:token';

const storage = (): Storage | null => {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
};

const sanitize = (value: unknown): string => {
  const token = String(value ?? '').trim();
  // V2EX token 是 UUID 形态；过短的输入基本是误粘贴，直接当作空。
  return token.length >= 16 && !/\s/.test(token) ? token : '';
};

const read = (): string => sanitize(storage()?.getItem(TOKEN_KEY));

/** 当前 token（空字符串 = 未登录）。组件里直接读这个 ref 即可获得响应式。 */
export const tokenRef = ref<string>(read());

export function getToken(): string {
  return tokenRef.value;
}

export function hasToken(): boolean {
  return tokenRef.value.length > 0;
}

export function writeToken(raw: string): string {
  const token = sanitize(raw);
  tokenRef.value = token;
  const store = storage();
  if (!store) return token;
  try {
    if (token) store.setItem(TOKEN_KEY, token);
    else store.removeItem(TOKEN_KEY);
  } catch {
    // 存储不可用（隐私模式 / 配额满）时只保留内存态。
  }
  return token;
}

export function clearToken(): void {
  writeToken('');
}
