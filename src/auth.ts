/**
 * 登录态（V2EX API 2.0 / Personal Access Token）。
 *
 * V2EX 没有 OAuth，也没有账号密码登录接口，唯一官方方式是用户在
 * https://www.v2ex.com/settings/tokens 自行生成 PAT，再粘贴到本插件。
 * 插件全程不接触账号密码，token 可随时在 V2EX 后台撤销。
 */
import { computed, ref } from 'vue';
import { fetchMyProfile, fetchTokenInfo, V2exApiError } from './api';
import { clearCache } from './cache';
import { clearToken, getToken, hasToken, writeToken } from './token';
import type { AuthStatus, V2exMember, V2exTokenInfo } from './types';

const statusRef = ref<AuthStatus>(hasToken() ? 'checking' : 'anonymous');
const profileRef = ref<V2exMember | null>(null);
const tokenInfoRef = ref<V2exTokenInfo | null>(null);
const errorRef = ref('');

export const authStatus = computed(() => statusRef.value);
export const currentMember = computed(() => profileRef.value);
export const currentTokenInfo = computed(() => tokenInfoRef.value);
export const authError = computed(() => errorRef.value);
export const isAuthenticated = computed(() => statusRef.value === 'authenticated');

const toMessage = (error: unknown): string => {
  if (error instanceof V2exApiError) {
    if (error.kind === 'auth') return 'invalid-token';
    if (error.kind === 'network') return 'network';
    if (error.kind === 'rate') return 'rate';
    return error.detail || error.message;
  }
  return error instanceof Error ? error.message : String(error);
};

const resetState = (): void => {
  profileRef.value = null;
  tokenInfoRef.value = null;
  statusRef.value = 'anonymous';
};

/**
 * 用新 token 建立会话：先落盘再校验，校验失败立刻清掉，避免留下坏 token。
 * 返回是否成功，失败原因写入 authError。
 */
export async function signIn(rawToken: string): Promise<boolean> {
  const token = writeToken(rawToken);
  errorRef.value = '';

  if (!token) {
    resetState();
    errorRef.value = 'empty-token';
    return false;
  }

  statusRef.value = 'checking';

  try {
    const [info, member] = await Promise.all([fetchTokenInfo(), fetchMyProfile()]);
    tokenInfoRef.value = info ?? null;
    profileRef.value = member ?? null;
    statusRef.value = 'authenticated';
    // 换了账号，之前按 url 缓存的主题/回复可能来自另一个会话，直接丢弃。
    clearCache();
    return true;
  } catch (error) {
    clearToken();
    resetState();
    statusRef.value = 'invalid';
    errorRef.value = toMessage(error);
    return false;
  }
}

export function signOut(): void {
  clearToken();
  resetState();
  errorRef.value = '';
  clearCache();
}

/** 启动时校验已保存的 token；失败（撤销 / 过期）就静默退回未登录。 */
export async function restoreSession(): Promise<void> {
  if (!hasToken()) {
    resetState();
    return;
  }

  if (statusRef.value === 'authenticated' && profileRef.value) return;

  statusRef.value = 'checking';
  try {
    const [info, member] = await Promise.all([fetchTokenInfo(), fetchMyProfile()]);
    tokenInfoRef.value = info ?? null;
    profileRef.value = member ?? null;
    statusRef.value = 'authenticated';
    errorRef.value = '';
  } catch (error) {
    clearToken();
    resetState();
    errorRef.value = toMessage(error);
  }
}

/** 主题页打开时顺便刷新一次资料（比如铜币/头像变了），失败不影响浏览。 */
export async function refreshProfile(force = true): Promise<void> {
  if (!getToken()) return;
  try {
    profileRef.value = await fetchMyProfile(force);
    if (statusRef.value !== 'authenticated') statusRef.value = 'authenticated';
  } catch (error) {
    if (error instanceof V2exApiError && error.kind === 'auth') {
      clearToken();
      resetState();
      errorRef.value = toMessage(error);
    }
  }
}
