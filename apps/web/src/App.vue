<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import TabBar from '@/components/TabBar.vue'
import AppHeader from '@/components/AppHeader.vue'

const route = useRoute()
const showTab = computed(() => Boolean(route.meta.tab))
</script>

<template>
  <div class="shell">
    <AppHeader />
    <router-view v-slot="{ Component }">
      <transition name="page-fade" mode="out-in" appear>
        <component :is="Component" :key="route.fullPath" />
      </transition>
    </router-view>
    <TabBar v-if="showTab" />
  </div>
</template>

<style scoped>
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
