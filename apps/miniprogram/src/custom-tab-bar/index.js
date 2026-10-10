const tabs = [
  { key: 'today', text: '今日', icon: '/static/icons/clock-muted.png', iconOn: '/static/icons/clock-accent.png', url: '/pages/today/index' },
  { key: 'calendar', text: '日历', icon: '/static/icons/calendar-muted.png', iconOn: '/static/icons/calendar-accent.png', url: '/pages/calendar/index' },
  { key: 'courses', text: '课程', icon: '/static/icons/book-muted.png', iconOn: '/static/icons/book-accent.png', url: '/pages/courses/index' },
  { key: 'stats', text: '统计', icon: '/static/icons/bars-muted.png', iconOn: '/static/icons/bars-accent.png', url: '/pages/stats/index' },
]

// 指示块先在当前页滑到目标位置，快到终点时再切页，新页面直接停在终点。
const SLIDE_MS = 360
const SWITCH_AFTER_MS = 200

function appData() {
  const app = getApp()
  app.globalData = app.globalData || {}
  return app.globalData
}

function routeIndex() {
  const route = getCurrentPages().slice(-1)[0]?.route || ''
  return tabs.findIndex((tab) => route.indexOf(`pages/${tab.key}/`) >= 0)
}

let windowWidth = 0

function place(index) {
  if (!windowWidth) {
    const info = typeof wx.getWindowInfo === 'function' ? wx.getWindowInfo() : wx.getSystemInfoSync()
    windowWidth = info.windowWidth || 375
  }
  const width = windowWidth
  const bar = Math.min(width - 24, 432)
  const pad = 8
  const gap = 5
  const center = 74
  const extra = 36
  const base = (bar - pad * 2 - center - gap * 4 - extra) / 4
  const tabWidth = (slot) => (slot === index ? base + extra : base)
  let left = pad
  if (index === 1) left = pad + tabWidth(0) + gap
  if (index === 2) left = pad + tabWidth(0) + gap + tabWidth(1) + gap + center + gap
  if (index === 3) left = pad + tabWidth(0) + gap + tabWidth(1) + gap + center + gap + tabWidth(2) + gap
  return `left:${left}px;top:${pad}px;width:${tabWidth(index)}px;height:50px;opacity:1;`
}

// 微信给每个 tab 页各建一份底栏实例，页面被缓存时实例也被缓存。
// 每份实例只显示自己所属页面的下标（owner）。
Component({
  data: {
    selected: -1,
    open: false,
    instant: true,
    travel: false,
    jelly: false,
    covered: false,
    dark: false,
    canWrite: true,
    indicator: 'opacity:0;',
    left: tabs.slice(0, 2),
    right: tabs.slice(2),
  },
  lifetimes: {
    attached() {
      this.syncState()
      const guess = routeIndex()
      if (guess >= 0) this.own(guess)
    },
    detached() {
      this.clearTimers()
    },
  },
  pageLifetimes: {
    show() {
      this.syncState()
      if (this.owner !== undefined) this.own(this.owner)
    },
  },
  methods: {
    syncState() {
      const data = appData()
      const dark = data.theme === 'dark'
      const canWrite = data.canWrite !== false
      if (this.data.dark !== dark || this.data.canWrite !== canWrite) this.setData({ dark, canWrite })
    },
    clearTimers() {
      clearTimeout(this._travelTimer)
      clearTimeout(this._switchTimer)
      clearTimeout(this._settleTimer)
      clearTimeout(this._refineTimer)
    },
    /** 停在自己页面的下标上，不带动画。 */
    own(index) {
      if (index < 0 || index > 3) return
      this.owner = index
      this.navigating = false
      if (this.data.selected === index && !this.data.travel) {
        if (this.data.open) this.setData({ open: false })
        return
      }
      this.clearTimers()
      this.setData({ selected: index, open: false, instant: true, travel: false, indicator: place(index) })
      this._settleTimer = setTimeout(() => this.setData({ instant: false }), 60)
      this.refine(index)
    },
    refine(index) {
      this._refineTimer = setTimeout(() => {
        if (this.data.selected !== index) return
        const query = this.createSelectorQuery()
        query.select('#glass-tabbar').boundingClientRect()
        query.selectAll('.tab').boundingClientRect()
        query.exec((res) => {
          if (this.data.selected !== index) return
          const bar = res?.[0]
          const tab = res?.[1]?.[index]
          if (!bar?.width || !tab?.width) return
          this.setData({
            indicator: `left:${tab.left - bar.left}px;top:${tab.top - bar.top}px;width:${tab.width}px;height:${tab.height}px;opacity:1;`,
          })
        })
      }, SLIDE_MS + 120)
    },
    bounce() {
      this.setData({ jelly: false })
      wx.nextTick(() => {
        this.setData({ jelly: true })
        setTimeout(() => {
          if (this.data.jelly) this.setData({ jelly: false })
        }, 480)
      })
    },
    slideTo(index) {
      this.clearTimers()
      this.setData({ selected: index, open: false, instant: false, travel: true, indicator: place(index) })
      this._travelTimer = setTimeout(() => this.setData({ travel: false }), SLIDE_MS)
    },
    go(index) {
      const home = this.owner
      wx.switchTab({
        url: tabs[index].url,
        success: () => {
          // 离开后把这份底栏悄悄放回自己的位置，下次回来不会先看到上一次的位置。
          setTimeout(() => {
            if (home !== undefined) this.own(home)
          }, SLIDE_MS)
        },
        fail: () => {
          this.navigating = false
          wx.reLaunch({ url: tabs[index].url })
        },
      })
    },
    onTab(event) {
      const index = Number(event.currentTarget.dataset.index)
      if (!tabs[index] || this.navigating) return
      const current = this.owner !== undefined ? this.owner : routeIndex()
      if (index === current) {
        this.setData({ open: false })
        this.bounce()
        return
      }
      this.navigating = true
      this.slideTo(index)
      this._switchTimer = setTimeout(() => this.go(index), SWITCH_AFTER_MS)
    },
    toggle() {
      this.syncState()
      this.setData({ open: !this.data.open })
    },
    close() {
      this.setData({ open: false })
    },
    quick(event) {
      const kind = event.currentTarget.dataset.kind
      if (kind === 'family') {
        this.setData({ open: false })
        wx.navigateTo({ url: '/subpages/family/index' })
        return
      }
      if (appData().canWrite === false) {
        wx.showToast({ icon: 'none', title: '家人只能查看课表' })
        return
      }
      this.setData({ open: false })
      if (kind === 'add') {
        const data = appData()
        if (this.owner === 0 && typeof data.openTodayAdd === 'function') {
          data.openTodayAdd()
          return
        }
        data.pendingAdd = true
        this.navigating = true
        this.slideTo(0)
        this._switchTimer = setTimeout(() => this.go(0), SWITCH_AFTER_MS)
        return
      }
      wx.navigateTo({ url: kind === 'course' ? '/subpages/course-edit/index' : '/subpages/expense-edit/index' })
    },
  },
})
