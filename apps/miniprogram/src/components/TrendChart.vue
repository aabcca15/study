<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useThemeStore } from '@/utils/wx-theme'
import { currentMixBase, isDarkMix, mix } from '@/utils/color'

const props = defineProps<{
  title: string
  caption: string
  points: Array<{ label: string; value: number }>
  color: string
  valueFormatter: (value: number) => string
}>()

const canvasId = `trend-${props.color.replace('#', '')}`
const instance = getCurrentInstance()
const theme = useThemeStore()
const { mode } = storeToRefs(theme)
const maxValue = computed(() => Math.max(1, ...props.points.map((item) => item.value)))
const total = computed(() => props.points.reduce((sum, item) => sum + item.value, 0))

function coordinates(width: number) {
  const left = 12
  const right = Math.max(left + 20, width - 12)
  return props.points.map((item, index) => {
    const x = props.points.length <= 1 ? (left + right) / 2 : left + (index / (props.points.length - 1)) * (right - left)
    const y = 96 - (item.value / maxValue.value) * 72
    return { ...item, x, y }
  })
}

function draw() {
  const query = uni.createSelectorQuery().in(instance?.proxy)
  query.select(`#${canvasId}`).boundingClientRect((rect) => {
    const box = Array.isArray(rect) ? rect[0] : rect
    const width = box?.width || 320
    const ctx = uni.createCanvasContext(canvasId, instance?.proxy)
    const points = coordinates(width)
    ctx.clearRect(0, 0, width, 128)
    ctx.setStrokeStyle(isDarkMix() ? '#2d3546' : '#e6e8f0')
    ctx.setLineWidth(1)
    for (const y of [32, 64, 96]) {
      ctx.beginPath()
      ctx.moveTo(12, y)
      ctx.lineTo(width - 12, y)
      ctx.stroke()
    }
    if (!points.length) {
      ctx.draw()
      return
    }
    const line = () => {
      points.forEach((point, index) => {
        if (!index) {
          ctx.moveTo(point.x, point.y)
          return
        }
        const previous = points[index - 1]
        const before = points[index - 2] ?? previous
        const next = points[index + 1] ?? point
        const smoothing = 0.18
        ctx.bezierCurveTo(
          previous.x + (point.x - before.x) * smoothing,
          previous.y + (point.y - before.y) * smoothing,
          point.x - (next.x - previous.x) * smoothing,
          point.y - (next.y - previous.y) * smoothing,
          point.x,
          point.y,
        )
      })
    }
    ctx.beginPath()
    line()
    ctx.lineTo(width - 12, 104)
    ctx.lineTo(12, 104)
    ctx.closePath()
    ctx.setFillStyle(mix(props.color, currentMixBase(), isDarkMix() ? 0.72 : 0.82))
    ctx.fill()
    ctx.beginPath()
    line()
    ctx.setStrokeStyle(props.color)
    ctx.setLineWidth(4)
    ctx.setLineCap('round')
    ctx.setLineJoin('round')
    ctx.stroke()
    points.forEach((point) => {
      if (point.value <= 0) return
      ctx.beginPath()
      ctx.arc(point.x, point.y, 3.2, 0, Math.PI * 2)
      ctx.setFillStyle(currentMixBase())
      ctx.fill()
      ctx.setStrokeStyle(props.color)
      ctx.setLineWidth(2.4)
      ctx.stroke()
    })
    const step = Math.max(1, Math.ceil(points.length / 6))
    ctx.setFillStyle(isDarkMix() ? '#9aa3b8' : '#8b93a5')
    ctx.setFontSize(8)
    ctx.setTextAlign('center')
    points.forEach((point, index) => {
      if (index % step !== 0 && index !== points.length - 1) return
      ctx.fillText(point.label, point.x, 121)
    })
    ctx.draw()
  }).exec()
}

/** 任何一次录入都会产生新的 points 数组；曲线数值没变就不重画画布。 */
const signature = computed(() => `${mode.value}|${props.color}|${props.points.map((item) => `${item.label}:${item.value}`).join(',')}`)

onMounted(() => nextTick(draw))
watch(signature, () => nextTick(draw))
</script>

<template>
  <view class="trend-card">
    <view class="head">
      <view>
        <text class="title">{{ title }}</text>
        <text class="caption">{{ caption }}</text>
      </view>
      <text class="total" :style="{ color }">{{ valueFormatter(total) }}</text>
    </view>
    <canvas :id="canvasId" :canvas-id="canvasId" class="plot" />
  </view>
</template>

<style scoped>
.trend-card {
  margin-bottom: 12px;
  padding: 17px;
  border-radius: 24px;
  background: var(--paper);
  box-shadow: var(--elev-md), var(--glow-top);
}
.head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.title { display: block; color: var(--ink); font-size: 16px; font-weight: 800; }
.caption { display: block; margin-top: 4px; color: var(--muted); font-size: 10px; }
.total { font-size: 17px; font-weight: 800; letter-spacing: -0.03em; }
.plot { width: 100%; height: 128px; margin-top: 6px; }
</style>
