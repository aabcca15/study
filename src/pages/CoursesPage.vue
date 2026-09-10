<script setup lang="ts">
import { useAppStore } from '@/stores/app'
import { BILLING_MODE_LABEL, COURSE_TYPE_LABEL } from '@/domain/constants'
import { money } from '@/services/billing'
import type { Course } from '@/domain/types'
import { courseScheduleSummary } from '@/services/courseSchedule'
import CourseIcon from '@/components/CourseIcon.vue'

const store = useAppStore()

function scheduleSummary(course: Course) {
  return courseScheduleSummary(course, store.scheduleExceptions)
}
</script>

<template>
  <main class="page courses-page">
    <section class="hero courses-hero">
      <div>
        <p class="eyebrow">课程档案</p>
        <h1>我的课程</h1>
        <small>正在查看 {{ store.child?.name || 'Uday' }}</small>
      </div>
      <div class="course-tools">
        <div class="course-children" aria-label="切换孩子">
          <button
            v-for="child in store.snapshot.children"
            :key="child.id"
            type="button"
            :class="{ active: store.child?.id === child.id }"
            :style="{ '--avatar-color': child.avatarColor }"
            :aria-label="`查看${child.name}的课程`"
            :aria-pressed="store.child?.id === child.id"
            @click="store.selectChild(child.id)"
          >
            {{ child.avatarLabel }}
          </button>
        </div>
        <router-link
          class="add-course"
          aria-label="新增课程"
          :to="{ path: '/courses/edit', query: { returnTo: '/courses' } }"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
        </router-link>
      </div>
    </section>

    <section class="course-grid">
      <article
        v-for="course in store.courses"
        :key="course.id"
        class="course"
        :style="{ '--course-color': course.color }"
      >
        <div class="course-top">
          <span class="course-icon">
            <CourseIcon :name="course.icon ?? 'generic'" />
          </span>
          <router-link
            class="edit-course"
            :aria-label="`编辑${course.title}`"
            :to="{ path: `/courses/edit/${course.id}`, query: { returnTo: '/courses' } }"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="5" r="1.25" />
              <circle cx="12" cy="12" r="1.25" />
              <circle cx="12" cy="19" r="1.25" />
            </svg>
          </router-link>
        </div>
        <p class="course-type">{{ COURSE_TYPE_LABEL[course.type] }}</p>
        <h2>{{ course.title }}</h2>
        <p class="schedule">{{ scheduleSummary(course) }}</p>
        <div class="course-foot">
          <span>{{ BILLING_MODE_LABEL[course.billingMode] }}</span>
          <strong>{{ course.billingMode === 'free' ? '免费' : money(course.amount) }}</strong>
        </div>
      </article>
    </section>

    <p v-if="!store.courses.length" class="empty">还没有课程，先把学校上课时间和兴趣班加上。</p>
  </main>
</template>

<style scoped>
.courses-page {
  padding-top: 24px;
}

.courses-hero {
  align-items: center;
  margin-bottom: 28px;
}

.courses-hero h1 {
  font-size: 30px;
}

.courses-hero small {
  display: block;
  margin-top: 6px;
  color: var(--muted);
  font-size: 11px;
}

.course-tools {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 9px;
}

.course-children {
  display: flex;
  flex-direction: row-reverse;
  justify-content: flex-end;
}

.course-children button {
  display: grid;
  width: 32px;
  height: 32px;
  margin-left: -9px;
  padding: 0;
  place-items: center;
  color: color-mix(in srgb, var(--avatar-color, #7157d9) 76%, #252a38);
  border: 3px solid var(--bg);
  border-radius: 50%;
  background: color-mix(in srgb, var(--avatar-color, #7157d9) 18%, #fff);
  font-size: 8px;
  font-weight: 800;
  transition: transform .2s ease, background .2s ease;
}

.course-children button.active {
  z-index: 2;
  color: #fff;
  background: var(--avatar-color, #7157d9);
  transform: scale(1.08);
}

.add-course {
  display: grid;
  width: 40px;
  height: 40px;
  flex: 0 0 auto;
  padding: 0;
  place-items: center;
  color: var(--accent-text);
  border: 1px solid var(--line);
  border-radius: 50%;
  background: var(--paper);
  box-shadow: 0 7px 18px rgba(48,58,88,.07);
}

.add-course svg {
  width: 20px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-width: 1.8;
}

.course-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.course {
  --course-accent: color-mix(in srgb, var(--course-color) 52%, #222a3d);
  position: relative;
  min-height: 196px;
  margin-top: 10px;
  padding: 16px;
  color: #1f2430;
  border: 1px solid color-mix(in srgb, var(--course-color) 34%, var(--line));
  border-radius: 6px 22px 22px 22px;
  background: color-mix(in srgb, var(--course-color) 18%, #f7f8fb);
  box-shadow: 0 12px 28px rgba(48,58,88,.07);
  transition: transform .22s ease, box-shadow .22s ease;
}

.course::before {
  position: absolute;
  z-index: -1;
  top: -10px;
  left: 0;
  width: 66px;
  height: 18px;
  border: 1px solid color-mix(in srgb, var(--course-color) 34%, var(--line));
  border-bottom: 0;
  border-radius: 13px 13px 0 0;
  background: color-mix(in srgb, var(--course-color) 28%, #f7f8fb);
  content: "";
}

.course:hover {
  transform: translateY(-2px);
  box-shadow: 0 16px 32px rgba(48,58,88,.1);
}

.course-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.course-icon {
  display: grid;
  width: 45px;
  height: 45px;
  flex: 0 0 auto;
  place-items: center;
  color: var(--course-accent);
  border-radius: 15px;
  background: color-mix(in srgb, var(--course-color) 50%, #fff);
}

.course-icon svg {
  width: 23px;
  height: 23px;
}

.edit-course {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  color: color-mix(in srgb, var(--course-accent) 62%, var(--muted));
  border: 0;
  border-radius: 50%;
  background: transparent;
  transition: color .2s ease, background .2s ease;
}

.edit-course:hover {
  color: var(--course-accent);
  background: color-mix(in srgb, var(--course-color) 42%, #fff);
}

.edit-course svg {
  width: 18px;
  fill: currentColor;
}

.course-type {
  display: inline-block;
  margin: 18px 0 8px;
  padding: 3px 8px;
  color: var(--course-accent);
  border-radius: 7px;
  background: color-mix(in srgb, var(--course-color) 40%, #fff);
  font-size: 9px;
  font-weight: 700;
}

.course h2 {
  margin: 0;
  overflow: hidden;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -.03em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.schedule {
  min-height: 32px;
  margin: 7px 0 16px;
  color: var(--muted);
  font-size: 10px;
  line-height: 1.55;
}

.course-foot {
  display: flex;
  padding-top: 12px;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  border-top: 1px solid color-mix(in srgb, var(--course-color) 44%, var(--line));
  font-size: 9px;
}

.course-foot span {
  color: var(--muted);
}

.course-foot strong {
  font-size: 13px;
}

@media (max-width: 360px) {
  .course-grid {
    grid-template-columns: 1fr;
  }

  .course {
    min-height: 190px;
  }
}
</style>
