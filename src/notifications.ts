/**
 * V2EX 通知（API 2.0 /notifications）。
 *
 * 通知列表本身就是「未读提醒」，没有单独的已读字段；点开或删除后
 * 服务端不再返回该条，因此未读计数直接取列表长度。
 */
import { computed, ref } from 'vue';
import { deleteNotification, fetchNotifications, V2exApiError } from './api';
import { hasToken } from './token';
import type { V2exNotification } from './types';

const POLL_INTERVAL_MS = 3 * 60 * 1000;

const itemsRef = ref<V2exNotification[]>([]);
const loadingRef = ref(false);
const errorRef = ref<V2exApiError | null>(null);
const loadedRef = ref(false);

let pollTimer = 0;

export const notifications = computed(() => itemsRef.value);
export const notificationsLoading = computed(() => loadingRef.value);
export const notificationsError = computed(() => errorRef.value);
export const notificationsLoaded = computed(() => loadedRef.value);
export const unreadCount = computed(() => itemsRef.value.length);

export async function loadNotifications(force = false): Promise<void> {
  if (!hasToken()) {
    itemsRef.value = [];
    loadedRef.value = false;
    errorRef.value = null;
    return;
  }

  loadingRef.value = true;
  errorRef.value = null;

  try {
    itemsRef.value = await fetchNotifications(1, force);
    loadedRef.value = true;
  } catch (error) {
    itemsRef.value = [];
    errorRef.value = error instanceof V2exApiError ? error : new V2exApiError('network', String(error));
  } finally {
    loadingRef.value = false;
  }
}

/** 删除单条提醒：先本地下线，失败再回滚，避免界面闪一下又冒出来。 */
export async function removeNotification(id: number): Promise<boolean> {
  const snapshot = itemsRef.value;
  itemsRef.value = snapshot.filter((item) => item.id !== id);
  try {
    await deleteNotification(id);
    return true;
  } catch (error) {
    itemsRef.value = snapshot;
    errorRef.value = error instanceof V2exApiError ? error : new V2exApiError('network', String(error));
    return false;
  }
}

export function clearNotifications(): void {
  itemsRef.value = [];
  errorRef.value = null;
  loadedRef.value = false;
}

const tick = (): void => {
  void loadNotifications(true);
};

export function startNotificationPolling(): void {
  if (pollTimer || !hasToken()) return;
  tick();
  pollTimer = window.setInterval(tick, POLL_INTERVAL_MS);
}

export function stopNotificationPolling(): void {
  if (!pollTimer) return;
  window.clearInterval(pollTimer);
  pollTimer = 0;
}

/** 窗口在后台时不轮询，回到前台立刻补一次。 */
export function bindNotificationVisibility(): () => void {
  if (typeof document === 'undefined') return () => undefined;

  const onChange = (): void => {
    if (document.visibilityState === 'visible') {
      if (hasToken()) startNotificationPolling();
    } else {
      stopNotificationPolling();
    }
  };

  document.addEventListener('visibilitychange', onChange);
  return () => document.removeEventListener('visibilitychange', onChange);
}
