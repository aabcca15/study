<script setup lang="ts">
import { computed, ref } from 'vue'
import type { TimeSlotOption } from '@/services/schedule'

const props = defineProps<{
  modelValue: string
  options: TimeSlotOption[]
  ariaLabel?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const open = ref(false)

const current = computed(() => props.options.find((item) => item.value === props.modelValue))
const invalid = computed(() => Boolean(props.modelValue) && Boolean(current.value?.disabled))

function choose(option: TimeSlotOption) {
  if (option.disabled) return
  emit('update:modelValue', option.value)
  open.value = false
}
</script>

<template>
  <div class="time-select">
    <button
      class="time-trigger"
      :class="{ invalid }"
      type="button"
      :aria-label="ariaLabel"
      :aria-expanded="open"
      @click="open = !open"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.4" /><path d="M12 7.4V12l3.3 2" /></svg>
      <span>{{ modelValue || '选择时间' }}</span>
      <b>⌄</b>
    </button>

    <Transition name="time-menu">
      <div v-if="open" class="time-popover">
        <div class="time-grid">
          <button
            v-for="option in options"
            :key="option.value"
            type="button"
            :class="{ active: option.value === modelValue }"
            :disabled="option.disabled"
            :title="option.caption"
            @click="choose(option)"
          >{{ option.label }}</button>
        </div>
        <p class="time-legend">灰色时间段已有安排，无法选择。</p>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.time-select {
  position: relative;
}

.time-trigger {
  display: grid;
  width: 100%;
  min-height: 47px;
  grid-template-columns: 18px minmax(0, 1fr) 14px;
  align-items: center;
  gap: 9px;
  padding: 0 13px;
  color: var(--ink);
  text-align: left;
  border: 0;
  border-radius: 14px;
  background: var(--paper);
  box-shadow: inset 0 0 0 1px var(--line), var(--elev-sm);
}

.time-trigger.invalid {
  color: #c2483c;
  box-shadow: inset 0 0 0 1.5px color-mix(in srgb, #d9503f 55%, var(--line));
}

.time-trigger svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: var(--accent-text);
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}

.time-trigger b {
  color: var(--muted);
  font-size: 12px;
}

.time-popover {
  position: absolute;
  z-index: 40;
  top: calc(100% + 6px);
  right: 0;
  left: 0;
  padding: 9px;
  border-radius: 17px;
  background: var(--paper);
  box-shadow: var(--elev-lg), var(--glow-top);
}

.time-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  max-height: 216px;
  overflow-y: auto;
}

.time-grid button {
  min-height: 36px;
  color: var(--ink);
  border: 0;
  border-radius: 11px;
  background: color-mix(in srgb, var(--ink) 4%, var(--paper));
  font-size: 12px;
  font-weight: 650;
}

.time-grid button.active {
  color: #fff;
  background: var(--accent-gradient);
  box-shadow: 0 8px 16px -9px rgba(255,122,69,.8);
}

.time-grid button:disabled {
  color: color-mix(in srgb, var(--muted) 60%, transparent);
  background: color-mix(in srgb, var(--ink) 6%, transparent);
  cursor: not-allowed;
  text-decoration: line-through;
}

.time-legend {
  margin: 9px 2px 0;
  color: var(--muted);
  font-size: 10px;
}

.time-menu-enter-active,
.time-menu-leave-active {
  transition: opacity .16s ease, transform .16s ease;
  transform-origin: top;
}

.time-menu-enter-from,
.time-menu-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(.98);
}
</style>
