<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue';
import { fetchReplies, fetchTopic, V2exApiError } from '../api';
import { absoluteTime, parseTopicIdFromHref, relativeTime, sanitizeHtml } from '../format';
import { copyText, openLink } from '../links';
import type { V2exReply, V2exTopic } from '../types';
import AppIcon from './AppIcon.vue';
import V2Avatar from './V2Avatar.vue';

const props = defineProps<{
  topicId: number;
  t: (key: string, values?: Record<string, string | number>) => string;
}>();

const emit = defineEmits<{
  (event: 'back'): void;
  (event: 'open-topic', topicId: number): void;
  (event: 'open-node', nodeName: string): void;
}>();

const topic = ref<V2exTopic | null>(null);
const replies = ref<V2exReply[]>([]);
const loading = ref(true);
const error = ref<V2exApiError | null>(null);
const repliesFailed = ref(false);
const visibleCount = ref(80);
const copyState = ref<'idle' | 'ok' | 'fail'>('idle');
const scrollRef = ref<HTMLElement | null>(null);
let copyTimer = 0;

const topicUrl = computed(
  () => topic.value?.url || `https://www.v2ex.com/t/${props.topicId}`,
);

const visibleReplies = computed(() => replies.value.slice(0, visibleCount.value));
const hasMoreReplies = computed(() => replies.value.length > visibleCount.value);

const contentHtml = computed(() =>
  sanitizeHtml(topic.value?.content_rendered || topic.value?.content || ''),
);

const errorText = computed(() => {
  const current = error.value;
  if (!current) return '';
  switch (current.kind) {
    case 'rate':
      return props.t('errorRate');
    case 'notfound':
      return props.t('errorNotFound');
    case 'http':
      return props.t('errorHttp', { status: current.status ?? 0 });
    case 'parse':
      return props.t('errorParse');
    default:
      return props.t('errorNetwork');
  }
});

const load = async (force = false): Promise<void> => {
  loading.value = true;
  error.value = null;
  repliesFailed.value = false;
  copyState.value = 'idle';

  try {
    const detail = await fetchTopic(props.topicId, force);
    topic.value = detail;

    if (scrollRef.value) scrollRef.value.scrollTop = 0;

    try {
      replies.value = await fetchReplies(props.topicId, force);
    } catch {
      replies.value = [];
      repliesFailed.value = true;
    }
  } catch (caught) {
    error.value = caught instanceof V2exApiError ? caught : new V2exApiError('network', String(caught));
    topic.value = null;
    replies.value = [];
  } finally {
    loading.value = false;
  }
};

watch(
  () => props.topicId,
  () => {
    visibleCount.value = 80;
    void load();
  },
  { immediate: true },
);

watch(
  () => topic.value?.id,
  async () => {
    await nextTick();
    if (scrollRef.value) scrollRef.value.scrollTop = 0;
  },
);

const handleContentClick = (event: MouseEvent): void => {
  const target = event.target as HTMLElement | null;
  if (!target) return;

  const image = target.closest('img');
  if (image) {
    event.preventDefault();
    openLink((image as HTMLImageElement).src);
    return;
  }

  const anchor = target.closest('a[href]') as HTMLAnchorElement | null;
  if (!anchor) return;
  event.preventDefault();

  const href = anchor.getAttribute('href') || '';
  const linkedTopicId = parseTopicIdFromHref(href);
  if (linkedTopicId && linkedTopicId !== props.topicId) {
    emit('open-topic', linkedTopicId);
    return;
  }
  if (linkedTopicId === props.topicId) return;

  openLink(href);
};

const handleOpenBrowser = (): void => {
  openLink(topicUrl.value);
};

const handleCopy = async (): Promise<void> => {
  const ok = await copyText(topicUrl.value);
  copyState.value = ok ? 'ok' : 'fail';
  window.clearTimeout(copyTimer);
  copyTimer = window.setTimeout(() => {
    copyState.value = 'idle';
  }, 1800);
};

const loadMore = (): void => {
  visibleCount.value += 80;
};

onUnmounted(() => {
  window.clearTimeout(copyTimer);
});
</script>

<template>
  <section class="detail-pane">
    <header class="detail-head">
      <button class="back-button" :title="t('back')" @click="emit('back')">
        <AppIcon name="back" :size="15" />
        <span>{{ t('back') }}</span>
      </button>

      <span v-if="topic?.node?.title" class="head-node">
        <button class="head-node-button" @click="emit('open-node', topic?.node?.name ?? '')">
          {{ topic.node.title }}
        </button>
      </span>

      <span class="head-spacer" />

      <button class="icon-button" :title="t('copyLink')" @click="handleCopy">
        <AppIcon name="copy" :size="15" />
      </button>
      <button class="icon-button" :title="t('openInBrowser')" @click="handleOpenBrowser">
        <AppIcon name="external" :size="15" />
      </button>
    </header>

    <div ref="scrollRef" class="detail-scroll">
      <div v-if="loading" class="detail-loading">
        <span class="detail-skeleton detail-skeleton-title" />
        <span class="detail-skeleton detail-skeleton-meta" />
        <span v-for="index in 6" :key="`detail-skeleton-${index}`" class="detail-skeleton" />
      </div>

      <div v-else-if="error" class="detail-state">
        <span class="state-icon"><AppIcon name="alert" :size="22" /></span>
        <p class="state-title">{{ errorText }}</p>
        <p v-if="error.detail" class="state-detail">{{ error.detail }}</p>
        <button class="text-button" @click="load(true)">{{ t('retry') }}</button>
      </div>

      <template v-else-if="topic">
        <article class="article">
          <h1 class="article-title">{{ topic.title }}</h1>

          <div class="article-meta">
            <V2Avatar
              :src="topic.member?.avatar_normal"
              :name="topic.member?.username ?? ''"
              :size="26"
              :radius="7"
            />
            <span class="article-author">{{ topic.member?.username }}</span>
            <span class="meta-divider" />
            <span :title="absoluteTime(topic.created)">
              {{ t('postedAt', { time: relativeTime(topic.created) }) }}
            </span>
            <span class="meta-divider" />
            <span>{{ t('replyCount', { count: topic.replies ?? replies.length }) }}</span>
          </div>

          <div class="v2ex-rich article-content" @click="handleContentClick" v-html="contentHtml" />

          <div class="article-replies-head">
            <span>{{ t('replyCount', { count: topic.replies ?? replies.length }) }}</span>
            <span v-if="copyState === 'ok'" class="copied-hint">{{ t('copied') }}</span>
            <span v-else-if="copyState === 'fail'" class="copied-hint is-error">{{ t('copyFailed') }}</span>
          </div>

          <div v-if="repliesFailed" class="replies-state">{{ t('errorNetwork') }}</div>

          <div v-else-if="!replies.length" class="replies-state">{{ t('emptyReplies') }}</div>

          <div v-else class="reply-list">
            <article v-for="(reply, index) in visibleReplies" :key="reply.id" class="reply">
              <V2Avatar
                :src="reply.member?.avatar_normal"
                :name="reply.member?.username ?? ''"
                :size="26"
                :radius="7"
              />
              <div class="reply-body">
                <div class="reply-head">
                  <span class="reply-user">{{ reply.member?.username }}</span>
                  <span class="reply-floor">{{ t('floor', { floor: index + 1 }) }}</span>
                  <span class="reply-time" :title="absoluteTime(reply.created)">
                    {{ relativeTime(reply.created) }}
                  </span>
                </div>
                <div
                  class="v2ex-rich reply-content"
                  @click="handleContentClick"
                  v-html="sanitizeHtml(reply.content_rendered || reply.content)"
                />
              </div>
            </article>
          </div>

          <div class="reply-footer">
            <button v-if="hasMoreReplies" class="text-button" @click="loadMore">
              {{ t('loadMore') }}
            </button>
            <span v-else-if="replies.length" class="all-shown">{{ t('allRepliesShown') }}</span>
          </div>
        </article>
      </template>
    </div>
  </section>
</template>

<style scoped>
.detail-pane {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  min-height: 0;
  background: var(--v2-bg);
}

.detail-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  border-bottom: 1px solid var(--v2-border);
  background: var(--v2-bg);
}

.back-button {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 26px;
  padding: 0 8px 0 6px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--v2-text-2);
  font-size: 11.5px;
  cursor: pointer;
}

.back-button:hover {
  background: var(--v2-hover);
  color: var(--v2-text);
}

.head-node {
  display: inline-flex;
  min-width: 0;
  padding-inline-start: 4px;
  border-inline-start: 1px solid var(--v2-border);
}

.head-node-button {
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 3px 8px;
  border: 0;
  border-radius: 6px;
  background: var(--v2-fill);
  color: var(--v2-text-2);
  font-size: 10.5px;
  cursor: pointer;
}

.head-node-button:hover {
  background: var(--v2-hover-strong);
}

.head-spacer {
  flex: 1;
}

.detail-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.detail-loading {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 780px;
  padding: 26px 22px;
}

.detail-skeleton {
  height: 10px;
  border-radius: 5px;
  background: linear-gradient(
    90deg,
    var(--v2-skeleton) 25%,
    var(--v2-skeleton-shine) 37%,
    var(--v2-skeleton) 63%
  );
  background-size: 400% 100%;
  animation: skeleton-wave 1.4s ease infinite;
}

.detail-skeleton-title {
  height: 18px;
  width: 68%;
}

.detail-skeleton-meta {
  width: 34%;
  margin-bottom: 8px;
}

@keyframes skeleton-wave {
  0% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0 50%;
  }
}

.detail-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 70px 24px;
  text-align: center;
}

.state-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: var(--v2-fill);
  color: var(--v2-text-3);
}

.state-title {
  margin: 2px 0 0;
  font-size: 12.5px;
  color: var(--v2-text-2);
}

.state-detail {
  margin: 0;
  max-width: 340px;
  font-size: 10.5px;
  line-height: 1.5;
  color: var(--v2-text-3);
  word-break: break-word;
}

.text-button {
  margin-top: 4px;
  padding: 4px 10px;
  border: 1px solid var(--v2-border);
  border-radius: 7px;
  background: transparent;
  color: var(--v2-text-2);
  font-size: 11.5px;
  cursor: pointer;
}

.text-button:hover {
  background: var(--v2-hover);
  border-color: var(--v2-border-strong);
}

.article {
  max-width: 780px;
  margin: 0 auto;
  padding: 22px 24px 40px;
}

.article-title {
  margin: 0;
  font-size: 18px;
  font-weight: 650;
  line-height: 1.45;
  letter-spacing: -0.012em;
  color: var(--v2-text);
  word-break: break-word;
}

.article-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 7px;
  margin-top: 12px;
  font-size: 11px;
  color: var(--v2-text-3);
}

.article-author {
  font-size: 11.5px;
  font-weight: 500;
  color: var(--v2-text-2);
}

.meta-divider {
  width: 1px;
  height: 9px;
  background: var(--v2-border-strong);
  opacity: 0.7;
}

.article-content {
  margin-top: 16px;
}

.article-replies-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 26px;
  padding: 12px 0 10px;
  border-top: 1px solid var(--v2-border);
  font-size: 11.5px;
  font-weight: 600;
  color: var(--v2-text-2);
}

.copied-hint {
  font-size: 10.5px;
  font-weight: 400;
  color: var(--v2-success);
}

.copied-hint.is-error {
  color: var(--v2-danger);
}

.replies-state {
  padding: 22px 0;
  font-size: 11.5px;
  color: var(--v2-text-3);
  text-align: center;
}

.reply-list {
  display: flex;
  flex-direction: column;
}

.reply {
  display: flex;
  gap: 10px;
  padding: 12px 0;
  border-bottom: 1px solid var(--v2-border-soft);
}

.reply:last-child {
  border-bottom: 0;
}

.reply-body {
  flex: 1;
  min-width: 0;
}

.reply-head {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--v2-text-3);
}

.reply-user {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--v2-text-2);
}

.reply-floor {
  font-variant-numeric: tabular-nums;
  opacity: 0.8;
}

.reply-time {
  margin-inline-start: auto;
  font-size: 10px;
}

.reply-content {
  margin-top: 4px;
  font-size: 12.5px;
}

.reply-footer {
  display: flex;
  justify-content: center;
  padding-top: 14px;
}

.all-shown {
  font-size: 10.5px;
  color: var(--v2-text-3);
}

@media (max-width: 560px) {
  .article {
    padding: 16px 16px 32px;
  }

  .article-title {
    font-size: 16px;
  }
}
</style>
