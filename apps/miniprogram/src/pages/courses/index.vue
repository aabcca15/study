<script setup lang="ts">
import { computed, ref } from 'vue'
import dayjs from 'dayjs'
import { CHILD_AVATAR_OPTIONS, COURSE_TYPE_LABEL } from '@server-domain/constants'
import type { ChildAvatarKey, Course } from '@server-domain/types'
import { getCourseAmountLabel, getCourseBillingSummary, getCourseLifecycle } from '@server-domain/courseOverview'
import { courseScheduleProgress } from '@server-domain/courseSchedule'
import { showCloudError } from '@/cloud/call'
import { useFamilyPage } from '@/composables/useFamilyPage'
import TabBar from '@/components/TabBar.vue'
import SelectField from '@/components/SelectField.vue'

const store = useFamilyPage()
const editingChild = ref(false)
const childName = ref('')
const avatarKey = ref<ChildAvatarKey>('boy-blue')
const creating = ref(false)

const childOptions = computed(() =>
  store.snapshot.children.map((child) => ({ value: child.id, label: child.name })),
)
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
    itemList: [course.archived ? '恢复课程' : '结课', '删除课程'],
    success: async (res) => {
      try {
        if (res.tapIndex === 0) {
          if (course.archived) await store.restoreCourse(course.id)
          else await store.archiveCourse(course.id)
        }
        if (res.tapIndex === 1) {
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
  <view class="page">
    <view class="h1">课程安排</view>
    <text class="muted">管理 {{ store.child?.name || '孩子' }} 的排课和费用</text>

    <view class="field" style="margin-top: 20rpx">
      <text class="field-label">当前孩子</text>
      <SelectField
        :model-value="store.childId"
        :options="childOptions"
        @update:model-value="onChildChange"
      />
    </view>
    <view class="row">
      <button class="btn ghost" @click="startCreate">添加孩子</button>
      <button class="btn ghost" @click="startRename">改资料</button>
      <button class="btn ghost" @click="removeCurrent">删除</button>
    </view>

    <view v-if="editingChild" class="card" style="margin-top: 20rpx">
      <view class="field">
        <text class="field-label">名字</text>
        <input v-model="childName" maxlength="20" placeholder="孩子名字" />
      </view>
      <view class="chip-row">
        <text
          v-for="option in CHILD_AVATAR_OPTIONS"
          :key="option.key"
          class="chip"
          :class="{ active: avatarKey === option.key }"
          @click="avatarKey = option.key"
        >{{ option.label }}</text>
      </view>
      <button class="btn block" style="margin-top: 20rpx" @click="saveChild">保存孩子</button>
    </view>

    <view v-if="!cards.length" class="empty">还没有课程。点下方加号可以新增。</view>
    <view v-for="card in cards" :key="card.course.id" class="card">
      <view class="row">
        <text class="title">{{ card.course.title }}</text>
        <text class="chip">{{ card.lifecycle.label }}</text>
      </view>
      <text class="muted">{{ COURSE_TYPE_LABEL[card.course.type] }} · {{ getCourseAmountLabel(card.course) }}</text>
      <text class="muted">进度 {{ card.progress.completed }}/{{ card.progress.total }} · {{ card.billing.label }}</text>
      <view class="row" style="margin-top: 16rpx">
        <button class="btn ghost" @click="uni.navigateTo({ url: `/pages/course-edit/index?id=${card.course.id}` })">编辑</button>
        <button class="btn ghost" @click="uni.navigateTo({ url: `/pages/course-bills/index?id=${card.course.id}` })">账单</button>
        <button class="btn ghost" @click="more(card.course)">更多</button>
      </view>
    </view>

    <button class="link" @click="store.logout(); uni.reLaunch({ url: '/pages/login/index' })">退出登录</button>
    <TabBar active="courses" />
  </view>
</template>

<style scoped>
.title {
  font-size: 32rpx;
  font-weight: 700;
}
.link {
  margin-top: 12rpx;
  color: #8b93a5;
  background: transparent;
}
</style>
