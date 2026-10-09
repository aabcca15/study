<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useThemeStore } from '@/utils/wx-theme'

const theme = useThemeStore()
const { isDark } = storeToRefs(theme)
</script>

<template>
  <button hover-class="press-on" hover-stay-time="80" class="theme-toggle" :class="{ dark: isDark }" @click="theme.toggle()">
    <view class="glyph">
      <view class="ray a" />
      <view class="ray b" />
      <view class="ray c" />
      <view class="ray d" />
      <view class="orb" />
      <view class="cut" />
    </view>
  </button>
</template>

<style scoped>
.theme-toggle {
  display: flex;
  width: 38px;
  height: 38px;
  align-items: center;
  justify-content: center;
  color: var(--ink);
}

.glyph {
  position: relative;
  width: 20px;
  height: 20px;
}

.orb {
  position: absolute;
  top: 4px;
  left: 4px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: currentColor;
}

.cut {
  position: absolute;
  top: 2px;
  left: 8px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--header-bg);
  opacity: 0;
  transform: translate(8px, -8px) scale(0.2);
}

.ray {
  position: absolute;
  top: 9px;
  left: 9px;
  width: 2px;
  height: 4px;
  margin-left: -1px;
  border-radius: 999px;
  background: currentColor;
  transform-origin: 1px 1px;
}

.ray.a { transform: translateY(-8px); }
.ray.b { transform: translateY(8px); }
.ray.c { transform: rotate(90deg) translateY(-8px); }
.ray.d { transform: rotate(90deg) translateY(8px); }

.theme-toggle.dark .ray {
  opacity: 0;
  transform: scale(0.2);
}

.theme-toggle.dark .cut {
  opacity: 1;
  transform: translate(3px, -2px) scale(1);
}
</style>
