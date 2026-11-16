<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { authError, authStatus, currentMember, currentTokenInfo, isAuthenticated, signIn, signOut } from '../auth';
import {
  loadNotifications,
  notifications,
  notificationsError,
  notificationsLoading,
  removeNotification,
  unreadCount,
} from '../notifications';
import { absoluteTime, formatDate, parseTopicIdFromPayload, relativeTime, sanitizeHtml } from '../format';
import { openLink } from '../links';
import type { V2exNotification } from '../types';
import AppIcon from './AppIcon.vue';
import V2Avatar from './V2Avatar.vue';

const props = defineProps<{
  t: (key: string, values?: Record<string, string | number>) => string;
  narrow: boolean;
}>();

const emit = defineEmits<{
  (event: 'open-topic', topicId: number): void;
}>();

const TOKEN_PAGE = 'https://www.v2ex.com/settings/tokens';

const rootRef = ref<HTMLElement | null>(null);
const tokenInputRef = ref<HTMLInputElement | null>(null);
const open = ref(false);
const tokenInput = ref('');
const submitting = ref(false);
const removingIds = ref<number[]>([]);

const displayName = computed(() => currentMember.value?.username ?? '');
const avatar = computed(() => currentMember.value?.avatar_normal || currentMember.value?.avatar_large || '');
const unreadText = computed(() => (unreadCount.value > 99 ? '99+' : String(unreadCount.value)));

const tokenMeta = computed(() => {
  const info = currentTokenInfo.value;
  if (!info) return '';
  if (info.expiration) {
    const date = new Date(info.expiration * 1000);
    if (!Number.isNaN(date.getTime())) {
      return props.t('authTokenExpires', { date: formatDate(info.expiration) });
    }
  }
  return info.scope ? props.t('authTokenScope', { scope: info.scope }) : '';
});

const authErrorText = computed(() => {
  const code = authError.value;
  if (!code) return '';
  switch (code) {
    case 'empty-token':
      return props.t('authErrEmpty');
    case 'invalid-token':
      return props.t('authErrInvalid');
    case 'network':
      return props.t('authErrNetwork');
    case 'rate':
      return props.t('errorRate');
    default:
      return code;
  }
});

const listErrorText = computed(() => {
  const error = notificationsError.value;
  if (!error) return '';
  if (error.kind === 'auth') return props.t('authErrInvalid');
  if (error.kind === 'rate') return props.t('errorRate');
  if (error.kind === 'network') return props.t('errorNetwork');
  return props.t('errorParse');
});

const toggle = async (): Promise<void> => {
  open.value = !open.value;
  if (!open.value) return;

  if (isAuthenticated.value) {
    void loadNotifications(true);
    return;
  }

  await nextTick();
  tokenInputRef.value?.focus();
};

const close = (): void => {
  open.value = false;
};

const submitToken = async (): Promise<void> => {
  if (submitting.value) return;
  submitting.value = true;
  try {
    const ok = await signIn(tokenInput.value);
    if (ok) tokenInput.value = '';
  } finally {
    submitting.value = false;
  }
};

const doSignOut = (): void => {
  signOut();
  open.value = false;
};

const openTokenPage = (): void => {
  openLink(TOKEN_PAGE);
};

const openNotification = (item: V2exNotification): void => {
  const topicId = parseTopicIdFromPayload(item.payload);
  if (topicId) {
    open.value = false;
    emit('open-topic', topicId);
    return;
  }
  // payload 里没有主题 id（少见）时退回网页版提醒，避免猜错链接。
  openAllNotifications();
};

const onRemove = async (id: number): Promise<void> => {
  if (removingIds.value.includes(id)) return;
  removingIds.value = [...removingIds.value, id];
  try {
    await removeNotification(id);
  } finally {
    removingIds.value = removingIds.value.filter((item) => item !== id);
  }
};

const openAllNotifications = (): void => {
  openLink('https://www.v2ex.com/notifications');
};

const onDocumentPointerDown = (event: MouseEvent): void => {
  if (!open.value) return;
  const target = event.target as Node | null;
  if (target && rootRef.value?.contains(target)) return;
  open.value = false;
};

const onKeyDown = (event: KeyboardEvent): void => {
  if (event.key !== 'Escape' || !open.value) return;
  event.stopPropagation();
  open.value = false;
};

watch(isAuthenticated, (value) => {
  if (!value) tokenInput.value = '';
});

onMounted(() => {
  document.addEventListener('mousedown', onDocumentPointerDown);
  window.addEventListener('keydown', onKeyDown, true);
});

onUnmounted(() => {
  document.removeEventListener('mousedown', onDocumentPointerDown);
  window.removeEventListener('keydown', onKeyDown, true);
});
</script>

<template>
  <div ref="rootRef" class="account-menu">
    <button
      class="account-button"
      :class="{ 'is-authed': isAuthenticated }"
      :title="isAuthenticated ? displayName : t('authSignIn')"
      @click="toggle"
    >
      <V2Avatar v-if="isAuthenticated" :src="avatar" :name="displayName" :size="21" :radius="7" />
      <AppIcon v-else name="user" :size="15" />
      <span v-if="unreadCount > 0" class="unread-dot">{{ unreadText }}</span>
    </button>

    <div v-if="open" class="account-panel" :class="{ 'is-sheet': narrow }" role="dialog">
      <template v-if="isAuthenticated">
        <header class="panel-head">
          <V2Avatar :src="avatar" :name="displayName" :size="34" :radius="10" />
          <div class="panel-identity">
            <span class="panel-name">{{ displayName }}</span>
            <span v-if="tokenMeta" class="panel-meta">{{ tokenMeta }}</span>
          </div>
          <button class="icon-button compact" :title="t('authSignOut')" @click="doSignOut">
            <AppIcon name="logout" :size="14" />
          </button>
        </header>

        <div class="panel-section-head">
          <span class="section-title">
            {{ t('authNotifications') }}
            <span v-if="unreadCount > 0" class="section-count">{{ unreadText }}</span>
          </span>
          <button class="text-action" :disabled="notificationsLoading" @click="loadNotifications(true)">
            <AppIcon :name="notificationsLoading ? 'loader' : 'refresh'" :size="12" />
          </button>
        </div>

        <div class="notif-scroll">
          <div v-if="notificationsLoading && !notifications.length" class="notif-state">
            <AppIcon name="loader" :size="15" />
          </div>

          <div v-else-if="listErrorText" class="notif-state">
            <span>{{ listErrorText }}</span>
            <button class="text-button small" @click="loadNotifications(true)">{{ t('retry') }}</button>
          </div>

          <div v-else-if="!notifications.length" class="notif-state">
            <AppIcon name="inbox" :size="18" />
            <span>{{ t('authNoNotifications') }}</span>
          </div>

          <div
            v-for="item in notifications"
            :key="item.id"
            class="notif-item"
            role="button"
            tabindex="0"
            @click="openNotification(item)"
            @keydown.enter="openNotification(item)"
          >
            <V2Avatar
              :src="item.member?.avatar_normal"
              :name="item.member?.username ?? ''"
              :size="22"
              :radius="6"
            />
            <span class="notif-body">
              <span class="notif-text v2ex-rich" v-html="sanitizeHtml(item.text)" />
              <span class="notif-time" :title="absoluteTime(item.created)">{{ relativeTime(item.created) }}</span>
            </span>
            <span
              class="notif-remove"
              :class="{ 'is-busy': removingIds.includes(item.id) }"
              role="button"
              :title="t('authDeleteNotification')"
              @click.stop="onRemove(item.id)"
            >
              <AppIcon name="trash" :size="12" />
            </span>
          </div>
        </div>

        <footer class="panel-foot">
          <button class="text-action" @click="openAllNotifications">{{ t('authOpenNotifications') }}</button>
        </footer>
      </template>

      <template v-else>
        <header class="panel-head auth-head">
          <span class="auth-badge"><AppIcon name="lock" :size="13" /></span>
          <div class="panel-identity">
            <span class="panel-name">{{ t('authTitle') }}</span>
            <span class="panel-meta">{{ t('authSubtitle') }}</span>
          </div>
        </header>

        <p class="auth-note">{{ t('authNote') }}</p>

        <label class="token-field">
          <AppIcon class="token-icon" name="lock" :size="13" />
          <input
            ref="tokenInputRef"
            v-model="tokenInput"
            type="password"
            autocomplete="off"
            spellcheck="false"
            :placeholder="t('authTokenPlaceholder')"
            @keyup.enter="submitToken"
          />
        </label>

        <p class="auth-help">{{ t('authTokenHelp') }}</p>

        <div class="auth-actions">
          <button class="ghost-button" @click="openTokenPage">{{ t('authGetToken') }}</button>
          <button
            class="primary-button"
            :disabled="submitting || authStatus === 'checking'"
            @click="submitToken"
          >
            <AppIcon v-if="submitting || authStatus === 'checking'" name="loader" :size="12" />
            <span>{{ submitting || authStatus === 'checking' ? t('authVerifying') : t('authSubmit') }}</span>
          </button>
        </div>

        <p v-if="authErrorText" class="auth-error">{{ authErrorText }}</p>
        <p class="auth-privacy">{{ t('authPrivacy') }}</p>

        <div class="auth-limits">
          <span class="limits-title">{{ t('authScopeTitle') }}</span>
          <span class="limit is-on">{{ t('authScopeRead') }}</span>
          <span class="limit">{{ t('authScopeWrite') }}</span>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.account-menu {
  position: relative;
  display: flex;
  align-items: center;
}

.account-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--v2-text-2);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.account-button:hover {
  background: var(--v2-hover);
  color: var(--v2-text);
}

.account-button.is-authed {
  width: auto;
  min-width: 26px;
  padding: 0;
}

.unread-dot {
  position: absolute;
  top: -2px;
  inset-inline-end: -5px;
  min-width: 14px;
  height: 14px;
  padding: 0 3px;
  border-radius: 7px;
  /* 固定用偏深的红：--v2-danger 在暗色下偏粉，白字对比不足。 */
  background: #de4a52;
  color: #fff;
  font-size: 9px;
  line-height: 14px;
  font-weight: 600;
  text-align: center;
  font-variant-numeric: tabular-nums;
  box-shadow: 0 0 0 1.5px var(--v2-bg);
}

.account-panel {
  position: absolute;
  top: calc(100% + 8px);
  inset-inline-end: 0;
  z-index: 60;
  display: flex;
  flex-direction: column;
  width: 316px;
  max-height: 460px;
  padding: 10px;
  border: 1px solid var(--v2-border);
  border-radius: 12px;
  background: var(--v2-overlay);
  box-shadow: 0 14px 38px rgb(15 23 42 / 0.16), 0 2px 6px rgb(15 23 42 / 0.06);
  animation: panel-in 0.14s ease-out;
}

:global(html.dark) .account-panel {
  box-shadow: 0 18px 44px rgb(0 0 0 / 0.5), 0 2px 6px rgb(0 0 0 / 0.3);
}

@keyframes panel-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.panel-head {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 2px 2px 9px;
  border-bottom: 1px solid var(--v2-border-soft);
}

.auth-head {
  padding-top: 0;
}

.panel-identity {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.panel-name {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--v2-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.panel-meta {
  font-size: 10px;
  color: var(--v2-text-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.auth-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 8px;
  background: var(--v2-fill);
  color: var(--v2-text-3);
}

.icon-button.compact {
  width: 24px;
  height: 24px;
  border-radius: 7px;
}

.panel-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 9px 2px 5px;
}

.section-title {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--v2-text-3);
  text-transform: uppercase;
}

.section-count {
  padding: 0 4px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--v2-danger) 14%, transparent);
  color: var(--v2-danger);
  font-size: 9.5px;
  line-height: 13px;
  font-variant-numeric: tabular-nums;
}

.text-action {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 4px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--v2-text-3);
  font-size: 10.5px;
  cursor: pointer;
}

.text-action:hover {
  background: var(--v2-hover);
  color: var(--v2-text-2);
}

.notif-scroll {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  margin: 0 -4px;
  padding: 0 4px;
}

.notif-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
  padding: 8px 6px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  text-align: start;
  cursor: pointer;
  transition: background 0.13s ease;
}

.notif-item:hover {
  background: var(--v2-hover);
}

/* 条目之间用极细内阴影分隔，避免破坏 hover 圆角。 */
.notif-item + .notif-item {
  box-shadow: inset 0 1px 0 var(--v2-border-soft);
}

.notif-body {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  flex: 1;
}

.notif-text {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 11.5px;
  line-height: 1.5;
  color: var(--v2-text-2);
  word-break: break-word;
}

.notif-text :deep(a) {
  color: var(--v2-accent);
  text-decoration: none;
}

.notif-time {
  font-size: 9.5px;
  color: var(--v2-text-3);
}

.notif-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 6px;
  color: var(--v2-text-3);
  opacity: 0;
  transition: opacity 0.13s ease, background 0.13s ease, color 0.13s ease;
}

.notif-item:hover .notif-remove {
  opacity: 1;
}

.notif-remove:hover {
  background: color-mix(in srgb, var(--v2-danger) 12%, transparent);
  color: var(--v2-danger);
}

.notif-remove.is-busy {
  opacity: 1;
  pointer-events: none;
}

.notif-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
  padding: 26px 10px;
  font-size: 11px;
  color: var(--v2-text-3);
  text-align: center;
}

.panel-foot {
  display: flex;
  justify-content: center;
  padding-top: 8px;
  margin-top: 4px;
  border-top: 1px solid var(--v2-border-soft);
}

.text-button.small {
  margin-top: 0;
  padding: 3px 8px;
  font-size: 10.5px;
}

.auth-note {
  margin: 10px 2px 0;
  font-size: 11px;
  line-height: 1.55;
  color: var(--v2-text-2);
}

.token-field {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  margin-top: 10px;
  padding: 0 9px;
  border: 1px solid var(--v2-border);
  border-radius: 8px;
  background: var(--v2-fill);
  transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
}

.token-field:focus-within {
  border-color: var(--v2-accent);
  background: var(--v2-bg);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--v2-accent) 14%, transparent);
}

.token-icon {
  color: var(--v2-text-3);
}

.token-field input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--v2-text);
  font-size: 11.5px;
  font-family: inherit;
  letter-spacing: 0.02em;
}

.token-field input::placeholder {
  color: var(--v2-text-3);
}

.auth-help {
  margin: 6px 2px 0;
  font-size: 10px;
  line-height: 1.5;
  color: var(--v2-text-3);
}

.auth-actions {
  display: flex;
  gap: 6px;
  margin-top: 10px;
}

.ghost-button,
.primary-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  height: 28px;
  padding: 0 11px;
  border-radius: 8px;
  font-size: 11.5px;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, opacity 0.15s ease;
}

.ghost-button {
  border: 1px solid var(--v2-border);
  background: transparent;
  color: var(--v2-text-2);
}

.ghost-button:hover {
  background: var(--v2-hover);
  border-color: var(--v2-border-strong);
}

.primary-button {
  flex: 1;
  border: 1px solid transparent;
  background: var(--v2-accent);
  color: #fff;
  font-weight: 550;
}

.primary-button:hover {
  filter: brightness(1.05);
}

.primary-button:disabled {
  opacity: 0.62;
  cursor: default;
}

.auth-error {
  margin: 8px 2px 0;
  font-size: 10.5px;
  line-height: 1.5;
  color: var(--v2-danger);
}

.auth-privacy {
  margin: 8px 2px 0;
  font-size: 10px;
  line-height: 1.5;
  color: var(--v2-text-3);
}

.auth-limits {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
  padding-top: 9px;
  border-top: 1px solid var(--v2-border-soft);
}

.limits-title {
  font-size: 10px;
  color: var(--v2-text-3);
}

.limit {
  padding: 1px 6px;
  border-radius: 5px;
  background: var(--v2-fill);
  color: var(--v2-text-3);
  font-size: 9.5px;
  line-height: 15px;
}

.limit.is-on {
  background: color-mix(in srgb, var(--v2-success) 13%, transparent);
  color: var(--v2-success);
}

.account-panel.is-sheet {
  position: fixed;
  top: auto;
  inset-inline: 0;
  bottom: 0;
  width: auto;
  max-height: 74vh;
  padding-bottom: 12px;
  border-bottom: 0;
  border-radius: 14px 14px 0 0;
}
</style>
