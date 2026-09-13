<script setup lang="ts">
defineProps<{
  eyebrow?: string
  title: string
  avatarLabel?: string
  avatarColor?: string
}>()
</script>

<template>
  <header class="page-header">
    <div class="page-header-copy">
      <p v-if="eyebrow">{{ eyebrow }}</p>
      <h1>
        <i
          v-if="avatarLabel"
          :style="{ '--avatar-color': avatarColor }"
          aria-hidden="true"
        >{{ avatarLabel }}</i>
        {{ title }}
      </h1>
      <slot name="caption" />
    </div>
    <div v-if="$slots.actions" class="page-header-actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<style scoped>
.page-header {
  display: flex;
  min-height: 58px;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 22px;
  animation: page-header-in .42s ease both;
}

.page-header-copy {
  min-width: 0;
}

.page-header p {
  margin: 0 0 3px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 650;
  letter-spacing: .04em;
}

.page-header h1 {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
  margin: 0;
  color: var(--ink);
  font-size: 29px;
  font-weight: 800;
  letter-spacing: -.045em;
  line-height: 1.15;
}

.page-header h1 i {
  display: grid;
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  place-items: center;
  color: #fff;
  border-radius: 12px;
  background: linear-gradient(140deg, color-mix(in srgb, var(--avatar-color, #7b61ff) 88%, #fff) 0%, color-mix(in srgb, var(--avatar-color, #7b61ff) 72%, #2a2350) 100%);
  box-shadow: 0 10px 20px -10px color-mix(in srgb, var(--avatar-color, #7b61ff) 75%, transparent), inset 0 1px 0 rgba(255,255,255,.4);
  font-size: 10px;
  font-style: normal;
  letter-spacing: 0;
}

.page-header-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
}

@keyframes page-header-in {
  from { opacity: 0; transform: translateY(-7px); }
  to { opacity: 1; transform: none; }
}

@media (max-width: 360px) {
  .page-header { gap: 10px; }
  .page-header h1 { font-size: 25px; }
}
</style>
