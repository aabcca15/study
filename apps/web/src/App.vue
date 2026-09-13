<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import TabBar from '@/components/TabBar.vue'
import AppHeader from '@/components/AppHeader.vue'

const route = useRoute()
const router = useRouter()
const showTab = computed(() => Boolean(route.meta.tab))
const isEdit = computed(() => route.path.includes('/edit'))

function goBack() {
  const returnTo = typeof route.query.returnTo === 'string' ? route.query.returnTo : '/'
  router.push(returnTo.startsWith('/') ? returnTo : '/')
}
</script>

<template>
  <div class="shell">
    <AppHeader />
    <header v-if="isEdit" class="edit-bar">
      <button class="edit-back" type="button" aria-label="返回" @click="goBack">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 6-6 6 6 6" /></svg>
      </button>
    </header>
    <router-view v-slot="{ Component }">
      <transition name="page-fade" mode="out-in" appear>
        <component :is="Component" :key="route.fullPath" />
      </transition>
    </router-view>
    <TabBar v-if="showTab" />
  </div>
</template>

<style scoped>
.edit-bar {
  max-width: 480px;
  margin: 0 auto;
  padding: 12px 18px 0;
}

.edit-back {
  display: grid;
  width: 42px;
  height: 42px;
  padding: 0;
  place-items: center;
  color: var(--ink);
  border: 0;
  border-radius: 50%;
  background: var(--paper);
  box-shadow: var(--elev-sm), var(--glow-top);
  transition: transform .2s ease, background .2s ease;
}

.edit-back:active {
  background: var(--accent-soft);
  transform: scale(.92);
}

.edit-back svg {
  width: 21px;
  height: 21px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}

.page-fade-enter-active,
.page-fade-leave-active {
  transition: opacity .26s ease, transform .32s cubic-bezier(.22,.8,.24,1);
}

.page-fade-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.page-fade-leave-to {
  opacity: 0;
  transform: translateY(-5px);
}

@media (prefers-reduced-motion: reduce) {
  .page-fade-enter-active,
  .page-fade-leave-active {
    transition: none;
  }
}

</style>
