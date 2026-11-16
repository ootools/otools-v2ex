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
  | 'bell'
  | 'user'
  | 'lock'
  | 'trash'
  | 'logout'
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
  bell:
    '<path d="M18 8.4a6 6 0 1 0-12 0c0 4.6-1.8 5.8-1.8 5.8h15.6S18 13 18 8.4Z"/><path d="M10.2 18.4a2 2 0 0 0 3.6 0"/>',
  user: '<circle cx="12" cy="8.2" r="3.6"/><path d="M4.8 20.2c.5-3.5 3.5-5.4 7.2-5.4s6.7 1.9 7.2 5.4"/>',
  lock:
    '<rect x="4.8" y="10.4" width="14.4" height="9.6" rx="2.6"/><path d="M8.4 10.4V7.9a3.6 3.6 0 0 1 7.2 0v2.5"/>',
  trash:
    '<path d="M4.4 7h15.2M9.4 7V5.6A1.6 1.6 0 0 1 11 4h2a1.6 1.6 0 0 1 1.6 1.6V7"/><path d="M6.6 7l.8 12.1A1.9 1.9 0 0 0 9.3 21h5.4a1.9 1.9 0 0 0 1.9-1.9L17.4 7"/>',
  logout:
    '<path d="M14.6 4.8h2.6A1.6 1.6 0 0 1 18.8 6.4v11.2a1.6 1.6 0 0 1-1.6 1.6h-2.6"/><path d="M10.4 8.2 6.6 12l3.8 3.8M6.6 12h8"/>',
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
