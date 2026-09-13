<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import dayjs from 'dayjs'

const props = withDefaults(defineProps<{
  modelValue: string
  mode?: 'date' | 'month'
  ariaLabel?: string
}>(), {
  mode: 'date',
  ariaLabel: '选择日期',
})

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const open = ref(false)
const cursor = ref(dayjs(props.modelValue || undefined))

watch(() => props.modelValue, (value) => {
  if (value) cursor.value = dayjs(props.mode === 'month' ? `${value}-01` : value)
})

const displayValue = computed(() => {
  if (!props.modelValue) return props.mode === 'month' ? '选择账期' : '选择日期'
  const value = dayjs(props.mode === 'month' ? `${props.modelValue}-01` : props.modelValue)
  return props.mode === 'month' ? value.format('YYYY年M月') : value.format('YYYY年M月D日')
})

const calendarDays = computed(() => {
  const start = cursor.value.startOf('month').startOf('week')
  return Array.from({ length: 42 }, (_, index) => start.add(index, 'day'))
})

function show() {
  cursor.value = dayjs(props.mode === 'month' ? `${props.modelValue || dayjs().format('YYYY-MM')}-01` : props.modelValue || undefined)
  open.value = true
}

function chooseDate(value: dayjs.Dayjs) {
  emit('update:modelValue', value.format('YYYY-MM-DD'))
  open.value = false
}

function chooseMonth(month: number) {
  const value = cursor.value.month(month)
  emit('update:modelValue', value.format('YYYY-MM'))
  open.value = false
}
</script>

<template>
  <div class="date-picker">
    <button class="date-trigger" type="button" :aria-label="ariaLabel" @click="show">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="5.5" width="16" height="14" rx="3" />
        <path d="M8 3.5v4M16 3.5v4M4 10h16" />
      </svg>
      <span>{{ displayValue }}</span>
      <b>⌄</b>
    </button>

    <Teleport to="body">
      <Transition name="picker">
        <div v-if="open" class="picker-backdrop" @click.self="open = false">
          <section class="picker-sheet" role="dialog" aria-modal="true" :aria-label="ariaLabel">
            <header>
              <button type="button" aria-label="上一周期" @click="cursor = cursor.subtract(1, mode === 'month' ? 'year' : 'month')">‹</button>
              <strong>{{ mode === 'month' ? cursor.format('YYYY年') : cursor.format('YYYY年M月') }}</strong>
              <button type="button" aria-label="下一周期" @click="cursor = cursor.add(1, mode === 'month' ? 'year' : 'month')">›</button>
            </header>

            <div v-if="mode === 'month'" class="month-grid">
              <button
                v-for="month in 12"
                :key="month"
                type="button"
                :class="{ selected: `${cursor.year()}-${String(month).padStart(2, '0')}` === modelValue }"
                @click="chooseMonth(month - 1)"
              >{{ month }}月</button>
            </div>

            <template v-else>
              <div class="week-row">
                <span v-for="label in ['日', '一', '二', '三', '四', '五', '六']" :key="label">{{ label }}</span>
              </div>
              <div class="day-grid">
                <button
                  v-for="day in calendarDays"
                  :key="day.format('YYYY-MM-DD')"
                  type="button"
                  :class="{
                    muted: !day.isSame(cursor, 'month'),
                    today: day.isSame(dayjs(), 'day'),
                    selected: day.format('YYYY-MM-DD') === modelValue,
                  }"
                  @click="chooseDate(day)"
                >{{ day.date() }}</button>
              </div>
            </template>

            <button class="picker-cancel" type="button" @click="open = false">取消</button>
          </section>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.date-trigger {
  display: grid;
  width: 100%;
  min-height: 46px;
  grid-template-columns: 20px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 0 13px;
  color: var(--ink);
  text-align: left;
  border: 0;
  border-radius: 14px;
  background: var(--paper);
  box-shadow: inset 0 0 0 1px var(--line), var(--elev-sm);
}

.date-trigger svg {
  width: 19px;
  fill: none;
  stroke: var(--accent-text);
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.7;
}

.date-trigger span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.date-trigger b { color: var(--muted); font-size: 13px; }

.picker-backdrop {
  position: fixed;
  z-index: 1100;
  inset: 0;
  display: grid;
  padding: 18px;
  align-items: end;
  background: rgba(29, 33, 43, .35);
  backdrop-filter: blur(5px);
}

.picker-sheet {
  width: min(100%, 444px);
  margin: 0 auto;
  padding: 18px;
  color: var(--ink);
  border: 0;
  border-radius: 26px;
  background: var(--paper);
  box-shadow: var(--elev-lg), var(--glow-top);
}

.picker-sheet header {
  display: grid;
  grid-template-columns: 40px 1fr 40px;
  align-items: center;
  margin-bottom: 14px;
  text-align: center;
}

.picker-sheet header button {
  width: 40px;
  height: 40px;
  color: var(--ink);
  border: 0;
  border-radius: 13px;
  background: var(--paper);
  box-shadow: var(--elev-sm), var(--glow-top);
  font-size: 22px;
}

.month-grid,
.day-grid,
.week-row {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 5px;
}

.month-grid { grid-template-columns: repeat(3, 1fr); gap: 9px; }
.week-row { margin-bottom: 5px; color: var(--muted); text-align: center; font-size: 10px; }

.month-grid button,
.day-grid button {
  min-height: 42px;
  color: var(--ink);
  border: 0;
  border-radius: 12px;
  background: transparent;
}

.month-grid button { min-height: 50px; background: var(--bg); }
.day-grid button.muted { color: var(--muted); opacity: .45; }
.day-grid button.today { box-shadow: inset 0 0 0 1px var(--accent); }
.month-grid button.selected,
.day-grid button.selected { color: #fff; background: var(--accent-gradient); box-shadow: 0 12px 20px -8px rgba(255,122,69,.7); }

.picker-cancel {
  width: 100%;
  margin-top: 14px;
  padding: 11px;
  color: var(--muted);
  border: 0;
  border-radius: 13px;
  background: var(--bg);
}

.picker-enter-active,
.picker-leave-active { transition: opacity .22s ease; }
.picker-enter-active .picker-sheet,
.picker-leave-active .picker-sheet { transition: transform .22s ease; }
.picker-enter-from,
.picker-leave-to { opacity: 0; }
.picker-enter-from .picker-sheet,
.picker-leave-to .picker-sheet { transform: translateY(28px); }
</style>
