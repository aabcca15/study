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
              :style="{ background: child.avatarColor || '#7b61ff' }"
              @click="onChildChange(child.id)"
            >{{ child.avatarLabel }}</button>
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
          <text
            v-for="option in CHILD_AVATAR_OPTIONS"
            :key="option.key"
            class="chip"
            :class="{ active: avatarKey === option.key }"
            @click="avatarKey = option.key"
          >{{ option.label }}</text>
        </view>
        <button class="btn block" style="margin-top: 16px" @click="saveChild">保存孩子</button>
      </view>

      <view class="course-grid">
        <view
          v-for="card in cards"
          :key="card.course.id"
          class="course"
          :class="{ inactive: card.lifecycle.inactive }"
          :style="{ '--course-color': card.course.color }"
        >
          <view class="tint" />
          <view class="course-top">
            <text class="badge">{{ card.lifecycle.label }}</text>
            <button class="more" @click="more(card.course)">···</button>
          </view>
          <text class="type">{{ COURSE_TYPE_LABEL[card.course.type] }}</text>
          <text class="name">{{ card.course.title }}</text>
          <view class="bar"><view :style="{ width: card.progress.percent + '%' }" /></view>
          <text class="meta">{{ card.progress.completed }}/{{ card.progress.total }} 课时 · {{ card.progress.percent }}%</text>
          <view class="foot">
            <text>{{ card.billing.label }}</text>
            <text class="amount">{{ getCourseAmountLabel(card.course) }}</text>
          </view>
          <view class="links">
            <text @click="uni.navigateTo({ url: `/pages/course-edit/index?id=${card.course.id}` })">编辑</text>
            <text @click="uni.navigateTo({ url: `/pages/course-bills/index?id=${card.course.id}` })">账单</text>
          </view>
        </view>
        <view class="course add" @click="uni.navigateTo({ url: '/pages/course-edit/index' })">
          <text class="plus">＋</text>
          <text class="name">新增课程</text>
          <text class="meta">创建新的课程与排课计划</text>
        </view>
      </view>
    </view>
    <TabBar active="courses" />
  </view>
</template>

<style scoped>
.courses-page { padding-top: 8px; }
.faces { display: flex; flex-direction: row-reverse; }
.face {
  width: 32px;
  height: 32px;
  margin-left: -8px;
  border: 3px solid var(--bg);
  border-radius: 50%;
  color: #fff;
  font-size: 10px;
  font-weight: 800;
}
.face.active { transform: scale(1.06); }
.child-actions { display: flex; gap: 8px; margin: -8px 0 16px; }
.child-actions button { color: var(--accent-text); font-size: 12px; font-weight: 700; }
.course-grid { display: flex; flex-wrap: wrap; gap: 12px; }
.course {
  position: relative;
  width: calc(50% - 6px);
  min-height: 168px;
  box-sizing: border-box;
  padding: 14px;
  overflow: hidden;
  border-radius: 6px 22px 22px 22px;
  background: #fff;
  box-shadow: var(--elev-md);
}
.tint { position: absolute; inset: 0; background: var(--course-color); opacity: 0.14; }
.course-top, .type, .name, .bar, .meta, .foot, .links { position: relative; }
.course-top { display: flex; justify-content: space-between; align-items: center; }
.badge { padding: 3px 8px; border-radius: 999px; background: rgba(255,255,255,.8); font-size: 10px; }
.more { color: var(--muted); font-size: 16px; letter-spacing: 1px; }
.type { display: block; margin-top: 12px; color: var(--muted); font-size: 11px; }
.name { display: block; margin: 4px 0 10px; font-size: 16px; font-weight: 800; }
.bar { height: 5px; border-radius: 999px; background: rgba(255,255,255,.7); overflow: hidden; }
.bar view { height: 100%; background: var(--course-color); }
.meta { display: block; margin-top: 6px; color: var(--muted); font-size: 10px; }
.foot { display: flex; justify-content: space-between; margin-top: 10px; font-size: 11px; }
.amount { font-weight: 750; }
.links { display: flex; gap: 12px; margin-top: 8px; color: var(--accent-text); font-size: 12px; font-weight: 700; }
.course.add { display: flex; flex-direction: column; align-items: flex-start; justify-content: center; background: #fff; }
.plus { font-size: 28px; color: var(--accent-text); }
.course.inactive { opacity: 0.72; }
</style>
