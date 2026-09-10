<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  title: string
  caption: string
  points: Array<{ label: string; value: number }>
  color: string
  valueFormatter: (value: number) => string
}>()

const maxValue = computed(() => Math.max(1, ...props.points.map((item) => item.value)))
const total = computed(() => props.points.reduce((sum, item) => sum + item.value, 0))
const coordinates = computed(() =>
  props.points.map((item, index) => {
    const x = props.points.length <= 1 ? 160 : 12 + (index / (props.points.length - 1)) * 296
    const y = 96 - (item.value / maxValue.value) * 72
    return { ...item, x, y }
  }),
)
const linePath = computed(() =>
  coordinates.value.map((item, index) => `${index ? 'L' : 'M'} ${item.x} ${item.y}`).join(' '),
)
const areaPath = computed(() =>
  coordinates.value.length ? `${linePath.value} L 308 104 L 12 104 Z` : '',
)
const labelIndexes = computed(() => {
  if (!props.points.length) return []
  const step = Math.max(1, Math.ceil(props.points.length / 6))
  const indexes = props.points.map((_, index) => index).filter((index) => index % step === 0)
  if (indexes.at(-1) !== props.points.length - 1) indexes.push(props.points.length - 1)
  return indexes
})
</script>

<template>
  <section class="trend-card" :style="{ '--series-color': color }">
    <header>
      <div>
        <h2>{{ title }}</h2>
        <p>{{ caption }}</p>
      </div>
      <strong>{{ valueFormatter(total) }}</strong>
    </header>
    <div class="plot">
      <svg viewBox="0 0 320 128" role="img" :aria-label="`${title}走势图`">
        <line v-for="y in [32, 64, 96]" :key="y" x1="12" :y1="y" x2="308" :y2="y" class="grid-line" />
        <path v-if="areaPath" :d="areaPath" class="area" />
        <path v-if="linePath" :d="linePath" class="line" />
        <circle
          v-for="(point, index) in coordinates"
          v-show="point.value > 0"
          :key="index"
          :cx="point.x"
          :cy="point.y"
          r="2.6"
          class="point"
        />
        <text
          v-for="index in labelIndexes"
          :key="`label-${index}`"
          :x="coordinates[index]?.x"
          y="121"
          text-anchor="middle"
        >{{ coordinates[index]?.label }}</text>
      </svg>
    </div>
  </section>
</template>

<style scoped>
.trend-card {
  padding: 17px;
  border: 1px solid var(--line);
  border-radius: 24px;
  background: var(--paper);
  box-shadow: var(--shadow);
}

header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

h2 {
  font-size: 16px;
}

p {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 10px;
}

header strong {
  color: var(--series-color, var(--ink));
  font-size: 17px;
  letter-spacing: -.03em;
}

.plot {
  margin: 10px -5px -4px;
}

svg {
  display: block;
  width: 100%;
  overflow: visible;
}

.grid-line {
  stroke: var(--line);
  stroke-width: 1;
}

.area {
  fill: var(--series-color);
  opacity: .08;
}

.line {
  fill: none;
  stroke: var(--series-color);
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2.5;
}

.point {
  fill: var(--paper);
  stroke: var(--series-color);
  stroke-width: 2;
}

text {
  fill: var(--muted);
  font-size: 8px;
}
</style>
