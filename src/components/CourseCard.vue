<script setup lang="ts">
import { COURSE_TYPE_LABEL } from '@/domain/constants'
import type { Course } from '@/domain/types'

defineProps<{
  course: Course
}>()
</script>

<template>
  <article class="card item">
    <div class="row">
      <div>
        <p class="muted">{{ course.recurrence.startTime }} - {{ course.recurrence.endTime }}</p>
        <h3>{{ course.title }}</h3>
        <p class="muted">{{ COURSE_TYPE_LABEL[course.type] }} · {{ course.location || '地点待填' }}</p>
      </div>
      <span class="chip dot" :style="{ color: course.color }">{{ course.teacher || '未填老师' }}</span>
    </div>
  </article>
</template>

<style scoped>
.item h3 {
  margin: 2px 0 4px;
  font-size: 17px;
}
</style>
