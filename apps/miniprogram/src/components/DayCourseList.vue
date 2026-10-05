<script setup lang="ts">
import type { DayOccurrence } from '@server-domain/types'
import { payLabel } from '@/utils/view'
import { useFamilyStore } from '@/stores/family'

defineProps<{
  items: DayOccurrence[]
}>()

const emit = defineEmits<{
  edit: [item: DayOccurrence]
}>()

const store = useFamilyStore()
</script>

<template>
  <view v-if="!items.length" class="empty">这一天还没有课程</view>
  <view
    v-for="item in items"
    :key="item.id"
    class="card course-row"
    @click="emit('edit', item)"
  >
    <view class="bar" :style="{ background: item.course.color }" />
    <view class="body">
      <view class="row">
        <text class="title">{{ item.course.title }}</text>
        <text :class="payLabel(store.overviewExpenses, item.course, item.date).startsWith('已支付') ? 'pay-paid' : 'pay-unpaid'">
          {{ payLabel(store.overviewExpenses, item.course, item.date) }}
        </text>
      </view>
      <text class="muted">
        {{ item.course.recurrence.startTime }}–{{ item.course.recurrence.endTime }}
        <text v-if="item.course.location"> · {{ item.course.location }}</text>
      </text>
    </view>
  </view>
</template>

<style scoped>
.course-row {
  display: flex;
  gap: 16rpx;
  padding: 22rpx;
}
.bar {
  width: 8rpx;
  border-radius: 8rpx;
}
.body {
  flex: 1;
}
.title {
  font-weight: 700;
}
</style>
