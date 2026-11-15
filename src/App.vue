<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import {
  fetchHotTopics,
  fetchLatestTopics,
  fetchNodeTopics,
  fetchNodes,
  rateLimit,
  rateRemaining,
  V2exApiError,
} from './api';
import { formatCount } from './format';
import { useV2exI18n } from './i18n';
import type { TopicSource, V2exNode, V2exTopic } from './types';
import AppIcon from './components/AppIcon.vue';
import NodeSidebar from './components/NodeSidebar.vue';
import TopicDetail from './components/TopicDetail.vue';
import TopicList from './components/TopicList.vue';
import logoUrl from '../logo.svg';

const { t, direction } = useV2exI18n();

const RECENT_KEY = 'otools-v2ex:recent-nodes';

const rootRef = ref<HTMLElement | null>(null);
const nodes = ref<V2exNode[]>([]);
const nodesLoading = ref(true);
const nodesError = ref<V2exApiError | null>(null);

const source = ref<TopicSource>({ kind: 'latest' });
const topics = ref<V2exTopic[]>([]);
const topicsLoading = ref(false);
const topicsError = ref<V2exApiError | null>(null);

const activeTopicId = ref<number | null>(null);
const query = ref('');
const narrow = ref(false);
const sidebarOpen = ref(false);
const recentNodes = ref<V2exNode[]>([]);

const isMock = import.meta.env.DEV && typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('mock');

const devTopicId = (() => {
  if (!import.meta.env.DEV || typeof window === 'undefined') return null;
  const raw = new URLSearchParams(window.location.search).get('topic');
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
})();

const toApiError = (error: unknown): V2exApiError =>
  error instanceof V2exApiError ? error : new V2exApiError('network', String(error));

const readRecent = (): V2exNode[] => {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(0, 6) : [];
  } catch {
    return [];
  }
};

const rememberNode = (node: V2exNode): void => {
  const compact: V2exNode = {
    id: node.id,
    name: node.name,
    title: node.title,
    avatar_mini: node.avatar_mini,
    topics: node.topics,
    parent_node_name: node.parent_node_name,
    root: node.root,
  };
  const next = [compact, ...recentNodes.value.filter((item) => item.name !== node.name)].slice(0, 6);
  recentNodes.value = next;
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // ignore storage failures
  }
};

const listTitle = computed(() => {
  if (source.value.kind === 'node') return source.value.node?.title || t('nodes');
  return source.value.kind === 'hot' ? t('hot') : t('latest');
});

const listSubtitle = computed(() => t('topicCount', { count: formatCount(topics.value.length) }));

const nodesErrorText = computed(() => {
  const error = nodesError.value;
  if (!error) return '';
  if (error.kind === 'rate') return t('errorRate');
  if (error.kind === 'parse') return t('errorParse');
  return t('errorNetwork');
});

const rateText = computed(() => {
  const remaining = rateRemaining.value;
  if (remaining === null) return '';
  const limit = rateLimit.value;
  return limit ? t('rateLimit', { remaining, limit }) : t('rateLimitRemaining', { remaining });
});

let topicsRequestToken = 0;

const loadNodes = async (force = false): Promise<void> => {
  nodesLoading.value = true;
  nodesError.value = null;
  try {
    nodes.value = await fetchNodes(force);
  } catch (error) {
    nodesError.value = toApiError(error);
  } finally {
    nodesLoading.value = false;
  }
};

const loadTopics = async (force = false): Promise<void> => {
  const token = ++topicsRequestToken;
  topicsLoading.value = true;
  topicsError.value = null;

  try {
    let list: V2exTopic[];
    if (source.value.kind === 'hot') {
      list = await fetchHotTopics(force);
    } else if (source.value.kind === 'latest') {
      list = await fetchLatestTopics(force);
    } else {
      const name = source.value.node?.name ?? '';
      list = name ? await fetchNodeTopics(name, force) : [];
    }
    if (token !== topicsRequestToken) return;
    topics.value = Array.isArray(list) ? list : [];
  } catch (error) {
    if (token !== topicsRequestToken) return;
    topics.value = [];
    topicsError.value = toApiError(error);
  } finally {
    if (token === topicsRequestToken) topicsLoading.value = false;
  }
};

const selectSource = (next: TopicSource): void => {
  activeTopicId.value = null;
  query.value = '';
  if (next.kind === 'node' && next.node) rememberNode(next.node);
  topics.value = [];
  topicsError.value = null;
  source.value = next;
};

const closeSidebar = (): void => {
  sidebarOpen.value = false;
};

const openTopic = (id: number): void => {
  activeTopicId.value = id;
  sidebarOpen.value = false;
};

const openNode = (name: string): void => {
  const node = nodes.value.find((item) => item.name === name);
  if (node) {
    selectSource({ kind: 'node', node });
  } else {
    activeTopicId.value = null;
  }
};

const goBack = (): void => {
  activeTopicId.value = null;
};

const refreshCurrent = (): void => {
  void loadTopics(true);
};

let resizeObserver: ResizeObserver | null = null;

const syncNarrow = (width: number): void => {
  const next = width < 700;
  if (next === narrow.value) return;
  narrow.value = next;
  if (!next) sidebarOpen.value = false;
};

const onWindowResize = (): void => {
  syncNarrow(window.innerWidth);
};

const onKeyDown = (event: KeyboardEvent): void => {
  if (event.key !== 'Escape') return;
  if (narrow.value && sidebarOpen.value) {
    sidebarOpen.value = false;
    return;
  }
  if (activeTopicId.value !== null) {
    activeTopicId.value = null;
  }
};

watch(source, () => {
  void loadTopics();
});

onMounted(() => {
  recentNodes.value = readRecent();
  if (devTopicId) activeTopicId.value = devTopicId;
  void loadNodes();
  void loadTopics();

  if (typeof ResizeObserver !== 'undefined' && rootRef.value) {
    resizeObserver = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? window.innerWidth;
      syncNarrow(width);
    });
    resizeObserver.observe(rootRef.value);
  } else {
    syncNarrow(window.innerWidth);
    window.addEventListener('resize', onWindowResize);
  }

  window.addEventListener('keydown', onKeyDown);
});

onUnmounted(() => {
  resizeObserver?.disconnect();
  window.removeEventListener('resize', onWindowResize);
  window.removeEventListener('keydown', onKeyDown);
});
</script>

<template>
  <div ref="rootRef" class="v2ex-app" :class="{ 'is-narrow': narrow }" :dir="direction">
    <header class="app-bar">
      <button
        v-if="narrow"
        class="icon-button bar-menu"
        :title="t('expandSidebar')"
        @click="sidebarOpen = true"
      >
        <AppIcon name="menu" :size="16" />
      </button>

      <div class="brand">
        <img class="brand-logo" :src="logoUrl" alt="" />
        <span class="brand-title">{{ t('appName') }}</span>
      </div>

      <label class="search-box">
        <AppIcon class="search-icon" name="search" :size="14" />
        <input v-model="query" type="text" :placeholder="t('searchPlaceholder')" spellcheck="false" />
        <button v-if="query" class="search-clear" type="button" @click="query = ''">
          <AppIcon name="close" :size="12" />
        </button>
      </label>

      <button class="icon-button" :title="t('refresh')" @click="refreshCurrent">
        <AppIcon name="refresh" :size="16" />
      </button>
    </header>

    <div class="app-body">
      <div v-if="narrow && sidebarOpen" class="sidebar-backdrop" @click="sidebarOpen = false" />

      <NodeSidebar
        v-show="!narrow || sidebarOpen"
        :nodes="nodes"
        :loading="nodesLoading"
        :source="source"
        :query="query"
        :recent-nodes="recentNodes"
        :narrow="narrow"
        :t="t"
        :error-text="nodesErrorText"
        @select="selectSource"
        @close="closeSidebar"
        @retry-nodes="loadNodes(true)"
      />

      <main class="app-main">
        <TopicList
          v-if="activeTopicId === null"
          :title="listTitle"
          :subtitle="listSubtitle"
          :topics="topics"
          :loading="topicsLoading"
          :error="topicsError"
          :query="query"
          :t="t"
          @open="(topic) => openTopic(topic.id)"
          @retry="refreshCurrent"
        />
        <TopicDetail
          v-else
          :topic-id="activeTopicId"
          :t="t"
          @back="goBack"
          @open-topic="openTopic"
          @open-node="openNode"
        />
      </main>
    </div>

    <footer class="status-bar">
      <span class="status-source">{{ t('source') }}</span>
      <span v-if="isMock" class="mock-badge">{{ t('mockHint') }}</span>
      <span class="status-spacer" />
      <span v-if="rateText" class="status-rate">{{ rateText }}</span>
    </footer>
  </div>
</template>

<style scoped>
.v2ex-app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  background: var(--v2-bg);
  color: var(--v2-text);
}

.app-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: none;
  height: 46px;
  padding: 0 12px;
  border-bottom: 1px solid var(--v2-border);
  background: var(--v2-bg);
}

.brand {
  display: flex;
  align-items: center;
  gap: 7px;
  flex: none;
  padding-inline-end: 4px;
}

.brand-logo {
  width: 22px;
  height: 22px;
  border-radius: 7px;
  display: block;
}

.brand-title {
  font-size: 13px;
  font-weight: 650;
  letter-spacing: 0.01em;
  color: var(--v2-text);
}

.search-box {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  max-width: 340px;
  height: 28px;
  margin-inline-start: 4px;
  padding: 0 8px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: var(--v2-fill);
  transition: background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
  cursor: text;
}

.search-box:focus-within {
  background: var(--v2-bg);
  border-color: var(--v2-accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--v2-accent) 14%, transparent);
}

.search-icon {
  color: var(--v2-text-3);
}

.search-box input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--v2-text);
  font-size: 12px;
  font-family: inherit;
}

.search-box input::placeholder {
  color: var(--v2-text-3);
}

.search-clear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border: 0;
  border-radius: 50%;
  background: var(--v2-border);
  color: var(--v2-text-2);
  cursor: pointer;
  padding: 0;
}

.search-clear:hover {
  background: var(--v2-border-strong);
}

.app-bar > .icon-button:last-child {
  margin-inline-start: auto;
}

.app-body {
  display: flex;
  flex: 1;
  min-height: 0;
  position: relative;
}

.app-main {
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
}

.sidebar-backdrop {
  position: fixed;
  inset: 0;
  z-index: 35;
  background: rgb(0 0 0 / 0.32);
  animation: backdrop-in 0.16s ease-out;
}

@keyframes backdrop-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.bar-menu {
  margin-inline-start: -4px;
}

.status-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: none;
  height: 24px;
  padding: 0 12px;
  border-top: 1px solid var(--v2-border);
  background: var(--v2-bg);
  color: var(--v2-text-3);
  font-size: 10px;
  white-space: nowrap;
  overflow: hidden;
}

.status-source {
  overflow: hidden;
  text-overflow: ellipsis;
}

.status-spacer {
  flex: 1;
}

.status-rate {
  font-variant-numeric: tabular-nums;
}

.mock-badge {
  padding: 0 5px;
  border-radius: 4px;
  background: color-mix(in srgb, #f0763a 16%, transparent);
  color: #d2601f;
  line-height: 14px;
}

.is-narrow .brand-title {
  font-size: 12.5px;
}

.is-narrow .search-box {
  max-width: none;
  margin-inline-start: 0;
}
</style>
