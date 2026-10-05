<script setup lang="ts">
import { computed, ref } from 'vue'
import dayjs from 'dayjs'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { billsInDueRange, money } from '@server-domain/billing'
import { CATEGORY_LABEL } from '@server-domain/constants'
import { showCloudError } from '@/cloud/call'
import { useFamilyPage } from '@/composables/useFamilyPage'
import { weekDates, weekLabel } from '@/utils/view'
import TabBar from '@/components/TabBar.vue'

const store = useFamilyPage({ refresh: false })
const anchor = ref(dayjs().format('YYYY-MM-DD'))
const fromToday = ref(false)

onLoad((query) => {
  fromToday.value = query?.from === 'today'
})

onShow(() => {
  if (!store.ready) return
  const period = anchor.value.slice(0, 7)
  store.generateBills(period).catch((error) => showCloudError(error))
})

const range = computed(() => weekDates(anchor.value))
const bills = computed(() =>
  billsInDueRange(store.overviewExpenses, range.value[0], range.value[6])
    .slice()
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
)
const openAmount = computed(() =>
  bills.value.filter((item) => item.status !== 'paid').reduce((sum, item) => sum + item.amount, 0),
)

function shift(delta: number) {
  anchor.value = dayjs(anchor.value).add(delta, 'week').format('YYYY-MM-DD')
  store.generateBills(anchor.value.slice(0, 7)).catch((error) => showCloudError(error))
}
</script>

<template>
  <view class="page">
    <view class="row">
      <button class="nav" @click="shift(-1)">上周</button>
      <text>{{ weekLabel(anchor) }}</text>
      <button class="nav" @click="shift(1)">下周</button>
    </view>
    <view class="card">
      <view class="row">
        <text>待支付</text>
        <text class="pay-unpaid">{{ money(openAmount) }}</text>
      </view>
    </view>
    <view v-if="!bills.length" class="empty">这周没有正式账单</view>
    <view
      v-for="bill in bills"
      :key="bill.id"
      class="card"
      @click="uni.navigateTo({ url: `/pages/expense-edit/index?id=${bill.id}` })"
    >
      <view class="row">
        <text class="title">{{ bill.title }}</text>
        <text>{{ money(bill.amount) }}</text>
      </view>
      <text class="muted">{{ bill.dueDate }} · {{ CATEGORY_LABEL[bill.category] }}</text>
      <text :class="bill.status === 'paid' ? 'pay-paid' : 'pay-unpaid'">
        {{ bill.status === 'paid' ? '已支付' : '未支付' }}
      </text>
    </view>
    <button class="btn block" @click="uni.navigateTo({ url: '/pages/expense-edit/index' })">记一笔</button>
    <TabBar :active="fromToday ? 'today' : 'stats'" />
  </view>
</template>

<style scoped>
.nav { background: transparent; color: #e85b2a; }
.title { font-weight: 700; }
</style>
