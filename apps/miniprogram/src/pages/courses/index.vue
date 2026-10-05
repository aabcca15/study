<script setup lang="ts">
import { computed, ref } from 'vue'
import dayjs from 'dayjs'
import { CHILD_AVATAR_OPTIONS, COURSE_TYPE_LABEL } from '@server-domain/constants'
import type { ChildAvatarKey, Course } from '@server-domain/types'
import { getCourseAmountLabel, getCourseBillingSummary, getCourseLifecycle, getCoursePricingLabel } from '@server-domain/courseOverview'
import { courseScheduleProgress } from '@server-domain/courseSchedule'
import { showCloudError } from '@/cloud/call'
import { useFamilyPage } from '@/composables/useFamilyPage'
import AppIcon from '@/components/AppIcon.vue'
import ChildAvatar from '@/components/ChildAvatar.vue'
import { cardBackground, deepTone, folderTab, mix, tileBackground } from '@/utils/color'
import AppHeader from '@/components/AppHeader.vue'
import PageHeader from '@/components/PageHeader.vue'

const store = useFamilyPage()
const editingChild = ref(false)
const childName = ref('')
const avatarKey = ref<ChildAvatarKey>('boy-blue')
const creating = ref(false)
const cards = computed(() => {
  const today = dayjs().format('YYYY-MM-DD')
  const period = dayjs().format('YYYY-MM')
  return store.allCourses
    .filter((course) => course.source !== 'temporary')
    .map((course) => ({
      course,
      lifecycle: getCourseLifecycle(course, store.scheduleExceptions, today),
      progress: courseScheduleProgress(course, today, store.scheduleExceptions),
      billing: getCourseBillingSummary(
        course,
        store.expenses,
        period,
        store.snapshot.charges ?? [],
        store.snapshot.occurrenceRecords ?? [],
      ),
    }))
})

function courseStyle(color: string, inactive: boolean) {
  if (inactive) {
    return {
      background: 'linear-gradient(150deg, #f4f5f8 0%, #ffffff 62%)',
      '--tab': '#eceef4',
    }
  }
  return {
    background: cardBackground(color),
    boxShadow: `0 2px 5px rgba(25,31,58,.04), 0 18px 34px -16px ${mix(color, '#6d6780', 0.35)}, inset 0 1px 0 rgba(255,255,255,.9)`,
    '--tab': folderTab(color),
  }
}

function startCreate() {
  creating.value = true
  editingChild.value = true
  childName.value = ''
  avatarKey.value = 'boy-blue'
}

function startRename() {
  if (!store.child) return
  creating.value = false
  editingChild.value = true
  childName.value = store.child.name
  avatarKey.value = store.child.avatarKey ?? 'boy-blue'
}

async function saveChild() {
  try {
    if (creating.value) await store.addChild(childName.value, avatarKey.value)
    else if (store.child) await store.updateChild(store.child.id, { name: childName.value, avatarKey: avatarKey.value })
    editingChild.value = false
  } catch (error) {
    showCloudError(error)
  }
}

function removeCurrent() {
  const child = store.child
  if (!child) return
  uni.showModal({
    title: `删除${child.name}`,
    content: '会删除只属于这个孩子的课程和账单。共享课只解除关联。',
    success: async (res) => {
      if (!res.confirm) return
      try {
        await store.removeChild(child.id)
      } catch (error) {
        showCloudError(error)
      }
    },
  })
}

async function onChildChange(id: string) {
  try {
    await store.selectChild(id)
  } catch (error) {
    showCloudError(error)
  }
}

function more(course: Course) {
  uni.showActionSheet({
    itemList: ['编辑课程', course.archived ? '恢复课程' : '标记已结课', '查看账单', '删除课程'],
    success: async (res) => {
      try {
        if (res.tapIndex === 0) {
          uni.navigateTo({ url: `/pages/course-edit/index?id=${course.id}` })
        }
        if (res.tapIndex === 1) {
          if (course.archived) await store.restoreCourse(course.id)
          else await store.archiveCourse(course.id)
        }
        if (res.tapIndex === 2) {
          uni.navigateTo({ url: `/pages/course-bills/index?id=${course.id}` })
        }
        if (res.tapIndex === 3) {
          uni.showModal({
            title: '删除课程',
            content: '未付账单会删除，已付账单会保留。',
            success: async (answer) => {
              if (!answer.confirm) return
              try {
                await store.removeCourse(course.id)
              } catch (error) {
                showCloudError(error)
              }
            },
          })
        }
      } catch (error) {
        showCloudError(error)
      }
    },
  })
}
</script>

<template>
  <view>
    <AppHeader />
    <view class="page courses-page">
      <PageHeader title="课程安排" :caption="`管理 ${store.child?.name || '孩子'} 的排课、进度与费用`">
        <template #actions>
          <view class="faces">
            <button
              v-for="child in store.snapshot.children"
              :key="child.id"
              class="face"
              :class="{ active: child.id === store.childId }"
              @click="onChildChange(child.id)"
            >
              <ChildAvatar :avatar-key="child.avatarKey" :size="32" />
            </button>
          </view>
        </template>
      </PageHeader>

      <view class="child-actions">
        <button @click="startCreate">添加孩子</button>
        <button @click="startRename">改资料</button>
        <button @click="removeCurrent">删除</button>
      </view>

      <view v-if="editingChild" class="card">
        <view class="field">
          <text class="field-label">名字</text>
          <input v-model="childName" maxlength="20" placeholder="孩子名字" />
        </view>
        <view class="chip-row">
          <view
            v-for="option in CHILD_AVATAR_OPTIONS"
            :key="option.key"
            class="avatar-pick"
            :class="{ active: avatarKey === option.key }"
            @click="avatarKey = option.key"
          >
            <ChildAvatar :avatar-key="option.key" :size="44" />
            <text>{{ option.label }}</text>
          </view>
        </view>
        <button class="btn block" style="margin-top: 16px" @click="saveChild">保存孩子</button>
      </view>

      <view class="course-grid">
        <view
          v-for="card in cards"
          :key="card.course.id"
          class="course"
          :class="{ inactive: card.lifecycle.inactive }"
          :style="courseStyle(card.course.color, card.lifecycle.inactive)"
        >
          <text v-if="card.lifecycle.inactive" class="watermark">{{ card.lifecycle.label }}</text>
          <view class="course-top">
            <view class="course-icon" :style="{ background: card.lifecycle.inactive ? '#aeb4c0' : tileBackground(card.course.color) }">
              <AppIcon :name="card.course.icon || 'generic'" tone="white" :size="23" />
            </view>
            <view class="course-actions" @click.stop>
              <text class="badge" :class="`is-${card.lifecycle.key}`">{{ card.lifecycle.label }}</text>
              <button class="more" @click="more(card.course)"><AppIcon name="dots" tone="muted" :size="18" /></button>
            </view>
          </view>
          <text class="type" :style="{ color: card.lifecycle.inactive ? '#8b93a5' : deepTone(card.course.color), background: card.lifecycle.inactive ? '#eef0f4' : mix(card.course.color, '#ffffff', 0.82) }">{{ COURSE_TYPE_LABEL[card.course.type] }}</text>
          <text class="name">{{ card.course.title }}</text>
          <view class="bar" :style="{ background: mix(card.course.color, '#eceef4', 0.86) }">
            <view :style="{ width: card.progress.percent + '%', background: card.lifecycle.inactive ? '#aeb4c0' : tileBackground(card.course.color) }" />
          </view>
          <text class="meta">{{ card.progress.completed }}/{{ card.progress.total }} 课时 · {{ card.progress.percent }}%</text>
          <view class="foot">
            <view>
              <text class="price">{{ getCoursePricingLabel(card.course) }}</text>
              <text v-if="card.billing.key !== 'free'" class="bill-state" :class="`is-${card.billing.key}`">{{ card.billing.label }}</text>
            </view>
            <view class="amount-col">
              <text class="amount">{{ getCourseAmountLabel(card.course) }}</text>
              <text v-if="card.billing.key === 'open'" class="pay" @click.stop="uni.navigateTo({ url: `/pages/course-bills/index?id=${card.course.id}` })">去支付</text>
            </view>
          </view>
        </view>
        <view class="course add" @click="uni.navigateTo({ url: '/pages/course-edit/index' })">
          <view class="plus"><AppIcon name="plus" tone="accent" :size="22" /></view>
          <text class="name">新增课程</text>
          <text class="meta">创建新的课程与排课计划</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.courses-page { padding-top: 8px; }
.faces { display: flex; flex-direction: row-reverse; }
.face {
  width: 32px;
  height: 32px;
  margin-left: -8px;
  padding: 0;
  border: 3px solid var(--bg);
  border-radius: 50%;
  overflow: hidden;
  background: transparent;
}
.face.active { transform: scale(1.06); }
.child-actions { display: flex; gap: 8px; margin: -8px 0 16px; }
.child-actions button { color: var(--accent-text); font-size: 12px; font-weight: 700; }
.avatar-pick { display: flex; width: calc(25% - 6px); box-sizing: border-box; flex-direction: column; align-items: center; gap: 4px; padding: 6px 2px; border-radius: 16px; color: var(--muted); font-size: 10px; }
.avatar-pick.active { box-shadow: 0 0 0 2px #ff7a45; color: var(--ink); }
.course-grid { display: flex; flex-wrap: wrap; gap: 12px; }
.course {
  position: relative;
  width: calc(50% - 6px);
  min-height: 168px;
  box-sizing: border-box;
  margin-top: 10px;
  padding: 14px 15px;
  overflow: visible;
  border-radius: 6px 22px 22px 22px;
  background: #fff;
}
.course::before {
  content: "";
  position: absolute;
  z-index: 0;
  top: -10px;
  left: 0;
  width: 66px;
  height: 18px;
  border-radius: 13px 13px 0 0;
  background: var(--tab, #eceef4);
}
.course-top, .type, .name, .bar, .meta, .foot { position: relative; z-index: 1; }
.course-top { display: flex; justify-content: space-between; align-items: center; }
.course-icon {
  display: flex;
  width: 45px;
  height: 45px;
  align-items: center;
  justify-content: center;
  border-radius: 15px;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.45);
}
.course-actions { display: flex; align-items: center; gap: 2px; }
.badge { padding: 4px 7px; border-radius: 999px; color: #1c8a5f; background: rgba(38,194,129,.16); font-size: 8px; font-weight: 800; }
.badge.is-upcoming, .badge.is-unscheduled { color: #a06a12; background: rgba(240,169,43,.18); }
.badge.is-ended, .badge.is-completed { color: #6e7482; background: rgba(124,138,165,.16); }
.more { display: flex; width: 28px; height: 28px; align-items: center; justify-content: center; }
.type { display: inline-block; margin-top: 14px; padding: 3px 8px; border-radius: 7px; font-size: 9px; font-weight: 700; }
.name { display: block; margin: 5px 0 10px; overflow: hidden; font-size: 17px; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
.bar { height: 5px; border-radius: 999px; overflow: hidden; }
.bar view { height: 100%; border-radius: inherit; }
.meta { display: block; margin-top: 6px; color: var(--muted); font-size: 10px; }
.foot { display: flex; justify-content: space-between; align-items: flex-end; gap: 8px; margin-top: 10px; }
.price, .bill-state { display: block; font-size: 11px; }
.bill-state.is-open { color: var(--unpaid); }
.bill-state.is-settled { color: var(--paid); }
.amount-col { text-align: right; }
.amount { display: block; font-size: 13px; font-weight: 750; }
.pay { display: block; margin-top: 4px; color: var(--accent-text); font-size: 11px; font-weight: 700; }
.watermark {
  position: absolute;
  right: 8px;
  bottom: 42px;
  color: rgba(91,96,110,.08);
  font-size: 28px;
  font-weight: 900;
  transform: rotate(-16deg);
}
.course.add { display: flex; flex-direction: column; align-items: flex-start; justify-content: center; background: #fff; box-shadow: var(--elev-md); }
.plus {
  display: flex;
  width: 42px;
  height: 42px;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
  border-radius: 14px;
  background: var(--accent-soft);
}
.course.inactive { color: var(--muted); }
</style>
