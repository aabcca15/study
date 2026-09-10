<script setup lang="ts">
import { computed, ref } from 'vue'
import dayjs from 'dayjs'
import { useAppStore } from '@/stores/app'
import { occurrencesInRange } from '@/services/schedule'
import { WEEKDAY_SHORT } from '@/domain/constants'
import CourseCard from '@/components/CourseCard.vue'

const store = useAppStore()
const cursor = ref(dayjs())
const selected = ref(dayjs().format('YYYY-MM-DD'))

const monthStart = computed(() => cursor.value.startOf('month'))
const grid = computed(() => {
  const start = monthStart.value.startOf('week')
  return Array.from({ length: 42 }, (_, i) => start.add(i, 'day'))
})

const monthOcc = computed(() =>
  occurrencesInRange(
    store.courses,
    monthStart.value.format('YYYY-MM-DD'),
    monthStart.value.endOf('month').format('YYYY-MM-DD'),
    store.scheduleExceptions,
  ),
)

function dots(date: string) {
  const colors = [...new Set(monthOcc.value.filter((o) => o.date === date).map((o) => o.course.color))]
  return colors.slice(0, 3)
}

const dayItems = computed(() => monthOcc.value.filter((o) => o.date === selected.value))

function pick(date: dayjs.Dayjs) {
  selected.value = date.format('YYYY-MM-DD')
  if (!date.isSame(cursor.value, 'month')) cursor.value = date
}
</script>

<template>
  <main class="page">
    <section class="hero">
      <div>
        <p class="eyebrow">课程日历</p>
        <h1>{{ cursor.format('YYYY年M月') }}</h1>
      </div>
      <div class="nav">
        <button class="btn ghost" type="button" @click="cursor = cursor.subtract(1, 'month')">上月</button>
        <button class="btn ghost" type="button" @click="cursor = dayjs(); selected = dayjs().format('YYYY-MM-DD')">本月</button>
        <button class="btn ghost" type="button" @click="cursor = cursor.add(1, 'month')">下月</button>
      </div>
    </section>

    <section class="card cal">
      <div class="week">
        <span v-for="d in WEEKDAY_SHORT" :key="d">{{ d }}</span>
      </div>
      <div class="days">
        <button
          v-for="day in grid"
          :key="day.format('YYYY-MM-DD')"
          type="button"
          class="day"
          :class="{
            muted: !day.isSame(cursor, 'month'),
            today: day.isSame(dayjs(), 'day'),
            on: day.format('YYYY-MM-DD') === selected,
          }"
          @click="pick(day)"
        >
          {{ day.date() }}
          <i class="dots">
            <b v-for="color in dots(day.format('YYYY-MM-DD'))" :key="color" :style="{ background: color }" />
          </i>
        </button>
      </div>
    </section>

    <section class="block">
      <div class="row">
        <h2>{{ dayjs(selected).format('M月D日') }} 课程</h2>
        <router-link
          class="btn accent"
          :to="{ path: '/courses/edit', query: { returnTo: '/calendar' } }"
        >
          加课程
        </router-link>
      </div>
      <div v-if="dayItems.length" class="list">
        <CourseCard v-for="item in dayItems" :key="item.id" :course="item.course" />
      </div>
      <p v-else class="empty">这一天还没有课程安排。</p>
    </section>
  </main>
</template>

<style scoped>
.nav {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.cal {
  margin-bottom: 18px;
}
.week,
.days {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  text-align: center;
}
.week {
  color: var(--muted);
  font-size: 12px;
  margin-bottom: 8px;
}
.day {
  position: relative;
  height: 46px;
  border: 0;
  background: transparent;
  border-radius: 12px;
}
.day.muted {
  color: #c0b7aa;
}
.day.today {
  font-weight: 700;
}
.day.on {
  background: #efe4d4;
}
.dots {
  display: flex;
  justify-content: center;
  gap: 3px;
  position: absolute;
  left: 0;
  right: 0;
  bottom: 6px;
}
.dots b {
  width: 5px;
  height: 5px;
  border-radius: 50%;
}
.block h2 {
  font-size: 18px;
}
</style>
