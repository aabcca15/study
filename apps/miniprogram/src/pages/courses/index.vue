<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { onShow } from '@dcloudio/uni-app'
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
import { setTabCover, syncVisibleTab } from '@/utils/nav'
import AppHeader from '@/components/AppHeader.vue'
import PageHeader from '@/components/PageHeader.vue'

const store = useFamilyPage()

onShow(() => {
  syncVisibleTab(2)
})
const managing = ref(false)
const editingAvatarId = ref('')
const newName = ref('')
const newAvatar = ref<ChildAvatarKey>('boy-blue')
const names = reactive<Record<string, string>>({})
const childError = ref('')

watch(managing, (open) => {
  setTabCover(open)
  if (!open) return
  childError.value = ''
  editingAvatarId.value = ''
  newName.value = ''
  newAvatar.value = 'boy-blue'
  for (const child of store.snapshot.children) names[child.id] = child.name
})
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

function faceStyle(color: string, inactive: boolean) {
  if (inactive) return { background: 'linear-gradient(150deg, #f4f5f8 0%, #ffffff 62%)' }
  return {
    background: cardBackground(color),
    boxShadow: `0 2px 5px rgba(25,31,58,.04), 0 18px 34px -16px ${mix(color, '#6d6780', 0.35)}, inset 0 1px 0 rgba(255,255,255,.9)`,
  }
}

async function saveName(id: string) {
  const name = (names[id] || '').trim()
  if (!name) return
  try {
    await store.updateChild(id, { name })
  } catch (error) {
    showCloudError(error)
  }
}

async function setAvatar(id: string, key: ChildAvatarKey) {
  try {
    await store.updateChild(id, { avatarKey: key })
    editingAvatarId.value = ''
  } catch (error) {
    showCloudError(error)
  }
}

async function addChild() {
  childError.value = ''
  if (!newName.value.trim()) {
    childError.value = '请先填写孩子名字'
    return
  }
  try {
    const id = await store.addChild(newName.value, newAvatar.value)
    if (!id) {
      childError.value = '请先填写孩子名字'
      return
    }
    names[id] = newName.value.trim()
    newName.value = ''
    newAvatar.value = 'boy-blue'
  } catch (error) {
    showCloudError(error)
  }
}

function removeCurrentChild(id: string, name: string) {
  uni.showModal({
    title: `删除${name}`,
    content: '会删除只属于这个孩子的课程和账单。共享课只解除关联。',
    success: async (res) => {
      if (!res.confirm) return
      try {
        await store.removeChild(id)
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
      <PageHeader title="课程安排" :caption="`管理 ${store.child?.name || '孩子'} 的排课、进度与费用`" />

      <view class="child-row">
        <view
          v-for="child in store.snapshot.children"
          :key="child.id"
          class="child-pill"
          :class="{ on: child.id === store.childId }"
          @click="onChildChange(child.id)"
        >
          <ChildAvatar :avatar-key="child.avatarKey" :size="40" />
          <text>{{ child.name }}</text>
        </view>
        <view class="manage" @click="managing = true">
          <AppIcon name="plus" tone="accent" :size="18" />
        </view>
      </view>

      <view class="course-grid">
        <view
          v-for="card in cards"
          :key="card.course.id"
          class="course"
          :class="{ inactive: card.lifecycle.inactive }"
        >
          <view class="bookmark" :style="{ background: card.lifecycle.inactive ? '#eceef4' : folderTab(card.course.color) }" />
          <view class="course-face" :style="faceStyle(card.course.color, card.lifecycle.inactive)">
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
        </view>
        <view class="course add" @click="uni.navigateTo({ url: '/pages/course-edit/index' })">
          <view class="plus"><AppIcon name="plus" tone="white" :size="22" /></view>
          <text class="name">新增课程</text>
          <text class="meta">创建新的课程与排课计划</text>
        </view>
      </view>
    </view>

    <view v-if="managing" class="mask" @click="managing = false">
      <view class="sheet" @click.stop>
        <view class="sheet-head">
          <view>
            <text class="eyebrow">家庭成员</text>
            <text class="sheet-title">孩子资料管理</text>
          </view>
          <text class="close" @click="managing = false">×</text>
        </view>
        <scroll-view scroll-y class="sheet-scroll" :show-scrollbar="false">
          <view v-for="child in store.snapshot.children" :key="child.id" class="profile">
            <view v-if="editingAvatarId !== child.id" @click="editingAvatarId = child.id">
              <ChildAvatar :avatar-key="child.avatarKey" :size="42" />
            </view>
            <view v-else class="avatar-choices">
              <view
                v-for="option in CHILD_AVATAR_OPTIONS"
                :key="option.key"
                :class="{ on: child.avatarKey === option.key }"
                @click="setAvatar(child.id, option.key)"
              >
                <ChildAvatar :avatar-key="option.key" :size="36" />
              </view>
            </view>
            <view class="field profile-name">
              <text class="field-label">孩子名称</text>
              <input v-model="names[child.id]" maxlength="8" @blur="saveName(child.id)" />
            </view>
            <text class="delete" @click="removeCurrentChild(child.id, child.name)">删除</text>
          </view>
          <text class="field-label">选择头像</text>
          <view class="avatar-choices new">
            <view
              v-for="option in CHILD_AVATAR_OPTIONS"
              :key="option.key"
              :class="{ on: newAvatar === option.key }"
              @click="newAvatar = option.key"
            >
              <ChildAvatar :avatar-key="option.key" :size="48" />
            </view>
          </view>
          <view class="new-row">
            <input v-model="newName" maxlength="8" placeholder="输入新孩子名字" />
            <button class="btn" @click="addChild">添加</button>
          </view>
          <text v-if="childError" class="form-error">{{ childError }}</text>
        </scroll-view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.courses-page { padding-top: 8px; }
.child-row { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: center; gap: 10px; margin: -4px 0 18px; }
.child-pill { display: flex; width: 52px; flex-direction: column; align-items: center; gap: 4px; color: var(--muted); font-size: 10px; }
.child-pill text { width: 100%; overflow: hidden; text-align: center; text-overflow: ellipsis; white-space: nowrap; }
.child-pill.on { color: var(--ink); font-weight: 750; }
.child-pill.on :deep(.child-face) { box-shadow: 0 0 0 2px #fff, 0 0 0 4px #8eb6ff; }
.manage {
  display: flex;
  width: 40px;
  height: 40px;
  align-items: center;
  justify-content: center;
  border: 1px dashed rgba(255, 122, 69, 0.45);
  border-radius: 50%;
  background: var(--accent-soft);
}
.course-grid { display: flex; flex-wrap: wrap; gap: 12px; }
.course {
  position: relative;
  width: calc(50% - 6px);
  margin-top: 10px;
  background: transparent;
}
.bookmark {
  position: absolute;
  z-index: 0;
  top: 0;
  left: 0;
  width: 66px;
  height: 18px;
  border-radius: 13px 13px 0 0;
}
.course-face {
  position: relative;
  z-index: 1;
  min-height: 168px;
  box-sizing: border-box;
  margin-top: 10px;
  padding: 14px 15px;
  overflow: hidden;
  border-radius: 6px 22px 22px 22px;
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
.course.add {
  display: flex;
  margin-top: 20px;
  min-height: 178px;
  box-sizing: border-box;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 16px 12px;
  border: 1.5px dashed rgba(255, 122, 69, 0.35);
  border-radius: 22px;
  background: linear-gradient(150deg, #fff4ee 0%, #fff 70%);
  text-align: center;
}
.course.add .name, .course.add .meta { width: 100%; text-align: center; }
.plus {
  display: flex;
  width: 48px;
  height: 48px;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
  border-radius: 50%;
  background: linear-gradient(135deg, #ffb45c 0%, #ff7a45 48%, #f15a36 100%);
  box-shadow: 0 10px 22px -10px rgba(255, 122, 69, 0.8);
}
.eyebrow { display: block; color: var(--accent-text); font-size: 11px; font-weight: 700; }
.close { width: 34px; height: 34px; border-radius: 50%; background: var(--bg); color: var(--muted); text-align: center; line-height: 34px; font-size: 22px; }
.profile { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; padding: 9px; border-radius: 16px; background: #f7f8fc; }
.profile-name { flex: 1; min-width: 0; margin-bottom: 0; }
.delete { color: #ed5d6e; font-size: 12px; font-weight: 700; }
.avatar-choices { display: flex; flex-wrap: wrap; gap: 8px; }
.avatar-choices.new { margin: 8px 0 12px; }
.avatar-choices .on :deep(.child-face) { box-shadow: 0 0 0 2px #ff7a45; }
.new-row { display: flex; align-items: center; gap: 8px; }
.new-row input { flex: 1; min-height: 44px; padding: 0 12px; border-radius: 14px; background: #fff; box-shadow: inset 0 0 0 1px var(--line); }
.form-error { display: block; margin-top: 8px; color: var(--unpaid); font-size: 12px; }
.course.inactive { color: var(--muted); }
</style>
