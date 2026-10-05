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
import AppHeader from '@/components/AppHeader.vue'
import PageHeader from '@/components/PageHeader.vue'

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
  <view>
    <AppHeader />
    <view class="page">
      <PageHeader eyebrow="全家账单" :title="weekLabel(anchor)">
        <template #actions>
          <view class="nav">
            <button @click="shift(-1)">‹</button>
            <button @click="shift(1)">›</button>
          </view>
        </template>
      </PageHeader>
      <view class="metrics">
        <view class="card metric"><text>待支付</text><text class="big pay-unpaid">{{ money(openAmount) }}</text></view>
        <view class="card metric"><text>账单数</text><text class="big">{{ bills.length }}</text></view>
      </view>
      <view v-if="!bills.length" class="empty">这周没有正式账单</view>
      <view
        v-for="bill in bills"
        :key="bill.id"
        class="card bill"
        @click="uni.navigateTo({ url: `/pages/expense-edit/index?id=${bill.id}` })"
      >
        <view class="row">
          <text class="title">{{ bill.title }}</text>
          <text class="amount">{{ money(bill.amount) }}</text>
        </view>
        <text class="muted">{{ bill.dueDate }} · {{ CATEGORY_LABEL[bill.category] }}</text>
        <text class="pill" :class="bill.status === 'paid' ? 'paid' : 'unpaid'">
          {{ bill.status === 'paid' ? '已支付' : '未支付' }}
        </text>
      </view>
    </view>
    <TabBar :active="fromToday ? 'today' : 'stats'" />
  </view>
</template>

<style scoped>
.nav { display: flex; padding: 3px; border-radius: 14px; background: #fff; box-shadow: var(--elev-sm); }
.nav button { width: 32px; height: 30px; color: var(--muted); font-size: 18px; }
.metrics { display: flex; gap: 10px; margin-bottom: 12px; }
.metric { flex: 1; margin-bottom: 0; }
.metric text { display: block; color: var(--muted); font-size: 12px; }
.big { margin-top: 6px; color: var(--ink); font-size: 22px; font-weight: 800; }
.title { font-weight: 700; }
.amount { font-weight: 750; }
.pill { display: inline-block; margin-top: 8px; padding: 3px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; }
.pill.paid { color: var(--paid); background: var(--paid-soft); }
.pill.unpaid { color: var(--unpaid); background: var(--unpaid-soft); }
</style>
