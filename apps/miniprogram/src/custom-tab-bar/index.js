const tabs = [
  { key: 'today', text: '今日', icon: '/static/icons/clock-muted.png', iconOn: '/static/icons/clock-accent.png', url: '/pages/today/index' },
  { key: 'calendar', text: '日历', icon: '/static/icons/calendar-muted.png', iconOn: '/static/icons/calendar-accent.png', url: '/pages/calendar/index' },
  { key: 'courses', text: '课程', icon: '/static/icons/book-muted.png', iconOn: '/static/icons/book-accent.png', url: '/pages/courses/index' },
  { key: 'stats', text: '统计', icon: '/static/icons/bars-muted.png', iconOn: '/static/icons/bars-accent.png', url: '/pages/stats/index' },
]

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
// 每份实例只显示自己所属页面的下标（owner），从不被别的页面改写。
Component({
  data: {
    selected: -1,
    open: false,
    instant: false,
    travel: false,
    jelly: false,
    covered: false,
    dark: false,
    indicator: 'opacity:0;',
    left: tabs.slice(0, 2),
    right: tabs.slice(2),
  },
  lifetimes: {
    ready() {
      this.syncTheme()
      if (this.owner === undefined) {
        const guess = routeIndex()
        if (guess >= 0) this.own(guess)
      }
    },
    detached() {
      this.clearTimers()
    },
  },
  pageLifetimes: {
    show() {
      this.syncTheme()
      if (this.owner !== undefined) this.own(this.owner)
    },
  },
  methods: {
    syncTheme() {
      const dark = appData().theme === 'dark'
      if (this.data.dark !== dark) this.setData({ dark })
    },
    clearTimers() {
      clearTimeout(this._slideTimer)
      clearTimeout(this._travelTimer)
      clearTimeout(this._refineTimer)
    },
    own(index) {
      if (index < 0 || index > 3) return
      this.owner = index
      const data = appData()
      const from = data.tabFrom
      const recent = data.tabStamp && Date.now() - data.tabStamp < 1200
      const slide = recent && typeof from === 'number' && from !== index && from >= 0
      if (!slide && this.data.selected === index) {
        if (this.data.open) this.setData({ open: false })
        return
      }
      data.tabFrom = undefined
      this.clearTimers()
      if (slide) {
        this.setData({ selected: index, open: false, instant: true, travel: false, indicator: place(from) })
        this._slideTimer = setTimeout(() => {
          this.setData({ instant: false, travel: true, indicator: place(index) })
          this._travelTimer = setTimeout(() => this.setData({ travel: false }), 240)
          this.refine(index)
        }, 30)
        return
      }
      this.setData({ selected: index, open: false, instant: false, travel: false, indicator: place(index) })
      this.refine(index)
    },
    refine(index) {
      this._refineTimer = setTimeout(() => {
        if (this.data.selected !== index) return
        const query = this.createSelectorQuery()
        query.select('#glass-tabbar').boundingClientRect()
        query.selectAll('.tab').boundingClientRect()
        query.exec((res) => {
          if (this.data.selected !== index || this.data.instant) return
          const bar = res?.[0]
          const tab = res?.[1]?.[index]
          if (!bar?.width || !tab?.width) return
          this.setData({
            indicator: `left:${tab.left - bar.left}px;top:${tab.top - bar.top}px;width:${tab.width}px;height:${tab.height}px;opacity:1;`,
          })
        })
      }, 520)
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
    go(index) {
      const data = appData()
      data.tabFrom = this.owner
      data.tabStamp = Date.now()
      wx.switchTab({
        url: tabs[index].url,
        fail: () => {
          data.tabFrom = undefined
          wx.reLaunch({ url: tabs[index].url })
        },
      })
    },
    onTab(event) {
      const index = Number(event.currentTarget.dataset.index)
      if (!tabs[index]) return
      const current = this.owner !== undefined ? this.owner : routeIndex()
      if (index === current) {
        this.setData({ open: false })
        this.bounce()
        return
      }
      this.setData({ open: false })
      this.go(index)
    },
    toggle() {
      if (appData().canWrite === false) {
        wx.showToast({ icon: 'none', title: '家人只能查看课表' })
        return
      }
      this.setData({ open: !this.data.open })
    },
    close() {
      this.setData({ open: false })
    },
    quick(event) {
      if (appData().canWrite === false) {
        wx.showToast({ icon: 'none', title: '家人只能查看课表' })
        return
      }
      const kind = event.currentTarget.dataset.kind
      this.setData({ open: false })
      if (kind === 'add') {
        const data = appData()
        if (this.owner === 0 && typeof data.openTodayAdd === 'function') {
          data.openTodayAdd()
          return
        }
        data.pendingAdd = true
        this.go(0)
        return
      }
      wx.navigateTo({ url: kind === 'course' ? '/pages/course-edit/index' : '/pages/expense-edit/index' })
    },
  },
})
