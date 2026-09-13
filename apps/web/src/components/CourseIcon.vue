<script setup lang="ts">
import type { CourseIcon } from '@/domain/types'

defineProps<{ name: CourseIcon }>()
</script>

<template>
  <svg v-if="name === 'school'" viewBox="0 0 24 24" aria-hidden="true">
    <path d="m3 10 9-5 9 5-9 5-9-5Zm4 2.2V18c3.2 1.5 6.8 1.5 10 0v-5.8M21 10v6" />
  </svg>
  <svg v-else-if="name === 'sport'" viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="8" /><path d="M6.2 7.2c3 1.3 5.1 3.2 6.2 5.8m5.4 3.8c-3-1.3-5.1-3.2-6.2-5.8M7 18c2.1-2.7 5.2-4.5 9.6-5.2M17 6c-2.1 2.7-5.2 4.5-9.6 5.2" />
  </svg>
  <svg v-else-if="name === 'math'" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5 7h6m-3-3v6m6-3h5M5 16l5 5m0-5-5 5m10-4h4m-4 4h4" />
  </svg>
  <svg v-else-if="name === 'reading'" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 5.5c3-.8 5.7-.2 8 1.8v12c-2.3-2-5-2.6-8-1.8v-12Zm16 0c-3-.8-5.7-.2-8 1.8v12c2.3-2 5-2.6 8-1.8v-12Z" />
  </svg>
  <svg v-else-if="name === 'music'" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M9 18V6l10-2v12M9 10l10-2" /><circle cx="6.5" cy="18.5" r="2.5" /><circle cx="16.5" cy="16.5" r="2.5" />
  </svg>
  <svg v-else-if="name === 'swimming'" viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="17" cy="5" r="2" /><path d="m5 13 4-4 4 3 3-2 3 3M3 16c2 0 2 1.5 4 1.5S9 16 11 16s2 1.5 4 1.5S17 16 19 16s2 1.5 2 1.5M3 20c2 0 2 1.5 4 1.5S9 20 11 20s2 1.5 4 1.5S17 20 19 20s2 1.5 2 1.5" />
  </svg>
  <svg v-else-if="name === 'english'" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5 19 10 5l5 14M7 14h6m3-5h4m-2-2v8m-2 4 4-4" />
  </svg>
  <svg v-else-if="name === 'calligraphy'" viewBox="0 0 24 24" aria-hidden="true">
    <path d="m16 3 5 5L10 19l-6 2 2-6L16 3Zm-8.5 11.5 5 5M14 5l5 5" />
  </svg>
  <svg v-else viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5 4h14v16H5zM8 8h8m-8 4h8m-8 4h5" />
  </svg>
</template>

<style scoped>
svg {
  width: 1em;
  height: 1em;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.7;
}
</style>
