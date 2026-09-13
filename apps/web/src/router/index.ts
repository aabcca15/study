import { createRouter, createWebHistory } from 'vue-router'
import TodayPage from '@/pages/TodayPage.vue'
import CalendarPage from '@/pages/CalendarPage.vue'
import BillsPage from '@/pages/BillsPage.vue'
import StatsPage from '@/pages/StatsPage.vue'
import CourseEditPage from '@/pages/CourseEditPage.vue'
import ExpenseEditPage from '@/pages/ExpenseEditPage.vue'
import CoursesPage from '@/pages/CoursesPage.vue'

const router = createRouter({
  history: createWebHistory(),
  scrollBehavior(_to, _from, savedPosition) {
    if (savedPosition) return savedPosition
    return { left: 0, top: 0, behavior: 'smooth' }
  },
  routes: [
    { path: '/', name: 'today', component: TodayPage, meta: { tab: 'today' } },
    { path: '/calendar', name: 'calendar', component: CalendarPage, meta: { tab: 'calendar' } },
    { path: '/bills', name: 'bills', component: BillsPage, meta: { tab: 'stats' } },
    { path: '/stats', name: 'stats', component: StatsPage, meta: { tab: 'stats' } },
    { path: '/courses', name: 'courses', component: CoursesPage, meta: { tab: 'courses' } },
    { path: '/courses/edit/:id?', name: 'course-edit', component: CourseEditPage },
    { path: '/bills/edit/:id?', name: 'expense-edit', component: ExpenseEditPage },
  ],
})

export default router
