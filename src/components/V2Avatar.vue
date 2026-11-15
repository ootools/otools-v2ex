<script setup lang="ts">
import { computed, ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    src?: string;
    name?: string;
    size?: number;
    radius?: number;
  }>(),
  { src: '', name: '', size: 32, radius: 9 },
);

const failed = ref(false);

watch(
  () => props.src,
  () => {
    failed.value = false;
  },
);

const initial = computed(() => {
  const value = (props.name || '?').trim();
  return value ? value.slice(0, 1).toUpperCase() : '?';
});

const palette = ['#5b8def', '#e8833a', '#3aa87a', '#a175e0', '#d95f7a', '#4aa3b8', '#8b8f3a', '#c06a3d'];

const color = computed(() => {
  const value = props.name || 'v2ex';
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 9973;
  }
  return palette[hash % palette.length];
});

const style = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  borderRadius: `${props.radius}px`,
  background: color.value,
  fontSize: `${Math.max(10, Math.round(props.size * 0.42))}px`,
}));
</script>

<template>
  <span class="v2-avatar" :style="style">
    <img
      v-if="src && !failed"
      :src="src"
      alt=""
      loading="lazy"
      referrerpolicy="no-referrer"
      @error="failed = true"
    />
    <span v-else class="v2-avatar-fallback">{{ initial }}</span>
  </span>
</template>

<style scoped>
.v2-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  overflow: hidden;
  color: #fff;
  font-weight: 600;
  line-height: 1;
  user-select: none;
}

.v2-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.v2-avatar-fallback {
  transform: translateY(-0.5px);
}
</style>
