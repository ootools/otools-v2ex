<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { TopicSource, V2exNode } from '../types';
import { formatCount } from '../format';
import AppIcon from './AppIcon.vue';
import V2Avatar from './V2Avatar.vue';

const props = defineProps<{
  nodes: V2exNode[];
  loading: boolean;
  source: TopicSource;
  query: string;
  recentNodes: V2exNode[];
  narrow: boolean;
  errorText?: string;
  t: (key: string, values?: Record<string, string | number>) => string;
}>();

const emit = defineEmits<{
  (event: 'select', source: TopicSource): void;
  (event: 'close'): void;
  (event: 'retry-nodes'): void;
}>();

const sortedNodes = computed(() =>
  [...props.nodes].sort((left, right) => (right.topics ?? 0) - (left.topics ?? 0)),
);

const nodeNames = computed(() => new Set(props.nodes.map((node) => node.name)));

const roots = computed(() =>
  sortedNodes.value.filter((node) => !node.parent_node_name || !nodeNames.value.has(node.parent_node_name)),
);

const childrenOf = (root: V2exNode): V2exNode[] =>
  sortedNodes.value.filter((node) => node.parent_node_name === root.name);

const expanded = ref<string[]>([]);

watch(
  () => roots.value.map((node) => node.name).join('|'),
  () => {
    if (!expanded.value.length && roots.value.length) {
      expanded.value = [roots.value[0].name];
    }
  },
  { immediate: true },
);

watch(
  () => props.source.node,
  (node) => {
    const parent = node?.parent_node_name;
    if (parent && !expanded.value.includes(parent)) {
      expanded.value = [...expanded.value, parent];
    }
  },
);

const isActive = (node: V2exNode): boolean =>
  props.source.kind === 'node' && props.source.node?.name === node.name;

const toggle = (name: string): void => {
  expanded.value = expanded.value.includes(name)
    ? expanded.value.filter((item) => item !== name)
    : [...expanded.value, name];
};

const selectNode = (node: V2exNode): void => {
  emit('select', { kind: 'node', node });
  if (props.narrow) emit('close');
};

const selectQuick = (kind: 'latest' | 'hot'): void => {
  emit('select', { kind });
  if (props.narrow) emit('close');
};

const searchedNodes = computed(() => {
  const query = props.query.trim().toLocaleLowerCase();
  if (!query) return [];
  return sortedNodes.value
    .filter((node) =>
      `${node.title} ${node.title_alternative ?? ''} ${node.name}`.toLocaleLowerCase().includes(query),
    )
    .slice(0, 60);
});
</script>

<template>
  <aside class="node-sidebar" :class="{ 'is-overlay': narrow }">
    <div v-if="narrow" class="sidebar-mobile-head">
      <span>{{ t('nodes') }}</span>
      <button class="icon-button" :title="t('collapseSidebar')" @click="emit('close')">
        <AppIcon name="close" :size="15" />
      </button>
    </div>

    <div class="sidebar-scroll">
      <section v-if="!query.trim()" class="quick-section">
        <button
          class="quick-item"
          :class="{ 'is-active': source.kind === 'latest' }"
          @click="selectQuick('latest')"
        >
          <span class="quick-icon quick-icon-latest"><AppIcon name="clock" :size="15" /></span>
          <span class="quick-text">
            <strong>{{ t('latest') }}</strong>
            <small>{{ t('latestDesc') }}</small>
          </span>
          <AppIcon class="quick-arrow" name="chevron-right" :size="13" />
        </button>
        <button
          class="quick-item"
          :class="{ 'is-active': source.kind === 'hot' }"
          @click="selectQuick('hot')"
        >
          <span class="quick-icon quick-icon-hot"><AppIcon name="fire" :size="15" /></span>
          <span class="quick-text">
            <strong>{{ t('hot') }}</strong>
            <small>{{ t('hotDesc') }}</small>
          </span>
          <AppIcon class="quick-arrow" name="chevron-right" :size="13" />
        </button>
      </section>

      <section v-if="!query.trim() && recentNodes.length" class="side-section">
        <h3 class="section-title">{{ t('recent') }}</h3>
        <div class="recent-list">
          <button
            v-for="node in recentNodes"
            :key="`recent-${node.name}`"
            class="recent-chip"
            :class="{ 'is-active': isActive(node) }"
            @click="selectNode(node)"
          >
            <V2Avatar :src="node.avatar_mini" :name="node.title" :size="16" :radius="5" />
            <span>{{ node.title }}</span>
          </button>
        </div>
      </section>

      <section class="side-section">
        <h3 class="section-title">
          <span>{{ query.trim() ? t('searchNodes') : t('allNodes') }}</span>
          <span v-if="!loading" class="section-count">{{ query.trim() ? searchedNodes.length : nodes.length }}</span>
        </h3>

        <div v-if="loading && !nodes.length" class="node-skeleton">
          <span v-for="index in 6" :key="`node-skeleton-${index}`" class="skeleton-line" />
        </div>

        <div v-else-if="errorText && !nodes.length" class="side-error">
          <p>{{ errorText }}</p>
          <button class="text-button" @click="emit('retry-nodes')">{{ t('retry') }}</button>
        </div>

        <div v-else-if="query.trim()" class="node-list">
          <button
            v-for="node in searchedNodes"
            :key="`search-${node.name}`"
            class="node-row is-flat"
            :class="{ 'is-active': isActive(node) }"
            @click="selectNode(node)"
          >
            <V2Avatar :src="node.avatar_mini" :name="node.title" :size="18" :radius="5" />
            <span class="node-title">{{ node.title }}</span>
            <span class="node-count">{{ formatCount(node.topics) }}</span>
          </button>
          <p v-if="!searchedNodes.length" class="side-empty">{{ t('noMatchingNodes') }}</p>
        </div>

        <div v-else class="node-list">
          <div v-for="root in roots" :key="`root-${root.name}`" class="node-group">
            <div class="node-row" :class="{ 'is-active': isActive(root) }">
              <button class="node-main" @click="selectNode(root)">
                <V2Avatar :src="root.avatar_mini" :name="root.title" :size="18" :radius="5" />
                <span class="node-title">{{ root.title }}</span>
                <span class="node-count">{{ formatCount(root.topics) }}</span>
              </button>
              <button
                v-if="childrenOf(root).length"
                class="node-toggle"
                :class="{ 'is-open': expanded.includes(root.name) }"
                @click.stop="toggle(root.name)"
              >
                <AppIcon name="chevron-right" :size="13" />
              </button>
            </div>

            <div v-if="expanded.includes(root.name)" class="node-children">
              <button
                v-for="child in childrenOf(root)"
                :key="`child-${child.name}`"
                class="node-row node-child"
                :class="{ 'is-active': isActive(child) }"
                @click="selectNode(child)"
              >
                <span class="node-dot" />
                <span class="node-title">{{ child.title }}</span>
                <span class="node-count">{{ formatCount(child.topics) }}</span>
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  </aside>
</template>

<style scoped>
.node-sidebar {
  display: flex;
  flex-direction: column;
  flex: 0 0 246px;
  width: 246px;
  min-height: 0;
  border-inline-end: 1px solid var(--v2-border);
  background: var(--v2-sidebar);
}

.node-sidebar.is-overlay {
  position: fixed;
  inset-block: 0;
  inset-inline-start: 0;
  z-index: 40;
  width: 268px;
  flex-basis: 268px;
  box-shadow: 0 18px 48px rgb(0 0 0 / 0.22);
  animation: sidebar-in 0.18s ease-out;
}

@keyframes sidebar-in {
  from {
    transform: translateX(-12px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

[dir='rtl'] .node-sidebar.is-overlay {
  animation-name: sidebar-in-rtl;
}

@keyframes sidebar-in-rtl {
  from {
    transform: translateX(12px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.sidebar-mobile-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid var(--v2-border);
  font-size: 12px;
  font-weight: 600;
  color: var(--v2-text-2);
}

.sidebar-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 6px 8px 18px;
}

.quick-section {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-bottom: 6px;
}

.quick-item {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 7px 8px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  text-align: start;
  cursor: pointer;
  color: var(--v2-text);
  transition: background 0.14s ease;
}

.quick-item:hover {
  background: var(--v2-hover);
}

.quick-item.is-active {
  background: var(--v2-active);
}

.quick-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 8px;
  flex: none;
}

.quick-icon-latest {
  background: color-mix(in srgb, #5b8def 16%, transparent);
  color: #4a7fe0;
}

.quick-icon-hot {
  background: color-mix(in srgb, #f0763a 16%, transparent);
  color: #e2682c;
}

.quick-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  flex: 1;
}

.quick-text strong {
  font-size: 12.5px;
  font-weight: 600;
  line-height: 1.3;
}

.quick-text small {
  font-size: 10.5px;
  color: var(--v2-text-3);
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quick-arrow {
  color: var(--v2-text-3);
  opacity: 0;
  transition: opacity 0.14s ease;
}

.quick-item:hover .quick-arrow,
.quick-item.is-active .quick-arrow {
  opacity: 1;
}

.side-section + .side-section {
  margin-top: 4px;
}

.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0;
  padding: 12px 8px 6px;
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--v2-text-3);
}

.section-count {
  font-variant-numeric: tabular-nums;
  font-weight: 500;
  opacity: 0.75;
}

.recent-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 0 4px 2px;
}

.recent-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px 3px 4px;
  border: 1px solid var(--v2-border);
  border-radius: 999px;
  background: transparent;
  color: var(--v2-text-2);
  font-size: 11px;
  line-height: 1.4;
  cursor: pointer;
  max-width: 100%;
  transition: border-color 0.14s ease, background 0.14s ease;
}

.recent-chip:hover {
  border-color: var(--v2-border-strong);
  background: var(--v2-hover);
}

.recent-chip.is-active {
  border-color: color-mix(in srgb, var(--v2-accent) 45%, transparent);
  color: var(--v2-accent);
  background: var(--v2-active);
}

.recent-chip span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.node-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.node-group {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.node-row {
  display: flex;
  align-items: center;
  height: 30px;
  border-radius: 7px;
  color: var(--v2-text-2);
  transition: background 0.12s ease, color 0.12s ease;
}

.node-row:hover {
  background: var(--v2-hover);
}

.node-row.is-active {
  background: var(--v2-active);
  color: var(--v2-accent);
}

.node-main {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
  height: 100%;
  padding: 0 4px 0 7px;
  border: 0;
  background: transparent;
  color: inherit;
  font-size: 12.5px;
  text-align: start;
  cursor: pointer;
}

.node-row.is-flat {
  width: 100%;
  gap: 8px;
  padding: 0 8px;
  border: 0;
  background: transparent;
  font-size: 12.5px;
  text-align: start;
  cursor: pointer;
}

.node-row.is-flat:hover {
  background: var(--v2-hover);
}

.node-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.node-count {
  font-size: 10.5px;
  color: var(--v2-text-3);
  font-variant-numeric: tabular-nums;
  padding-inline-end: 6px;
}

.node-row.is-active .node-count {
  color: color-mix(in srgb, var(--v2-accent) 70%, transparent);
}

.node-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  margin-inline-end: 3px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--v2-text-3);
  cursor: pointer;
  transition: transform 0.16s ease, background 0.14s ease;
}

.node-toggle:hover {
  background: var(--v2-hover-strong);
}

.node-toggle.is-open {
  transform: rotate(90deg);
}

[dir='rtl'] .node-toggle.is-open {
  transform: rotate(-90deg);
}

.node-children {
  display: flex;
  flex-direction: column;
  gap: 1px;
  margin-inline-start: 15px;
  padding-inline-start: 7px;
  border-inline-start: 1px solid var(--v2-border);
}

.node-child {
  width: 100%;
  gap: 7px;
  padding: 0 8px;
  border: 0;
  background: transparent;
  font-size: 12px;
  text-align: start;
  cursor: pointer;
}

.node-dot {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--v2-text-3);
  opacity: 0.55;
  flex: none;
}

.node-child.is-active .node-dot {
  background: var(--v2-accent);
  opacity: 1;
}

.node-skeleton {
  display: flex;
  flex-direction: column;
  gap: 9px;
  padding: 6px 8px;
}

.skeleton-line {
  height: 12px;
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

.skeleton-line:nth-child(2n) {
  width: 72%;
}

@keyframes skeleton-wave {
  0% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0 50%;
  }
}

.side-empty {
  margin: 0;
  padding: 18px 10px;
  font-size: 11.5px;
  color: var(--v2-text-3);
  text-align: center;
}

.side-error {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  margin: 2px 6px 6px;
  padding: 10px;
  border: 1px solid var(--v2-border);
  border-radius: 8px;
  background: var(--v2-fill);
}

.side-error p {
  margin: 0;
  font-size: 11px;
  line-height: 1.5;
  color: var(--v2-text-2);
}

.text-button {
  padding: 3px 9px;
  border: 1px solid var(--v2-border);
  border-radius: 6px;
  background: var(--v2-bg);
  color: var(--v2-text-2);
  font-size: 11px;
  cursor: pointer;
}

.text-button:hover {
  border-color: var(--v2-border-strong);
}
</style>
