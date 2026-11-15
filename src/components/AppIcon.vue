<script setup lang="ts">
import { computed } from 'vue';

type IconName =
  | 'search'
  | 'refresh'
  | 'menu'
  | 'back'
  | 'reply'
  | 'external'
  | 'chevron-right'
  | 'chevron-down'
  | 'close'
  | 'copy'
  | 'fire'
  | 'clock'
  | 'inbox'
  | 'alert'
  | 'hash'
  | 'loader';

const props = withDefaults(defineProps<{ name: IconName; size?: number }>(), { size: 16 });

const icons: Record<IconName, string> = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.6 6.1"/><path d="M20 4v7h-7"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  back: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
  reply:
    '<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H8l-5 2 1.6-4.6A8.5 8.5 0 1 1 21 11.5Z"/>',
  external:
    '<path d="M14 4h6v6M20 4l-9 9"/><path d="M19 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4"/>',
  'chevron-right': '<path d="m9 18 6-6-6-6"/>',
  'chevron-down': '<path d="m6 9 6 6 6-6"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
  fire:
    '<path d="M12 3c3 3.4 6 6.1 6 10a6 6 0 0 1-12 0c0-2 1-3.4 2-4.9.6 1.5 1.5 2 2.4 2 .6-2.5.5-4.6 1.6-7.1Z"/>',
  clock: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4.2l3 1.8"/>',
  inbox:
    '<path d="M4 13h4l1.6 2.4h4.8L16 13h4"/><path d="M4 13 6.4 5.6A2 2 0 0 1 8.3 4h7.4a2 2 0 0 1 1.9 1.6L20 13v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"/>',
  alert:
    '<circle cx="12" cy="12" r="9"/><path d="M12 7.2v5.6"/><circle cx="12" cy="16.6" r=".9" fill="currentColor" stroke="none"/>',
  hash: '<path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/>',
  loader: '<path d="M12 3a9 9 0 1 0 9 9"/>',
};

const inner = computed(() => icons[props.name] ?? '');
</script>

<template>
  <svg
    class="app-icon"
    :class="{ 'is-spinning': name === 'loader' }"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    v-html="inner"
  />
</template>

<style scoped>
.app-icon {
  display: block;
  flex: none;
}

.app-icon.is-spinning {
  animation: app-icon-spin 0.9s linear infinite;
}

@keyframes app-icon-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
