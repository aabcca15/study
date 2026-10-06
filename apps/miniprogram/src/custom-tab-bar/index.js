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
  if (route.indexOf('calendar') >= 0) return 1
  if (route.indexOf('courses') >= 0) return 2
  if (route.indexOf('stats') >= 0) return 3
  if (route.indexOf('today') >= 0) return 0
  return -1
}

function resolveIndex() {
  const data = appData()
  const fresh = typeof data.tabIndex === 'number' && data.tabStamp && Date.now() - data.tabStamp < 800
  if (fresh) return data.tabIndex
  const fromRoute = routeIndex()
  if (fromRoute >= 0) return fromRoute
  return typeof data.tabIndex === 'number' ? data.tabIndex : 0
}

function paintEveryBar(index, animate) {
  const seen = new Set()
  const paint = (bar) => {
    if (!bar || seen.has(bar) || typeof bar.showTab !== 'function') return
    seen.add(bar)
    bar.showTab(index, animate)
  }
  ;(appData().tabBars || []).forEach(paint)
  getCurrentPages().forEach((page) => {
    const raw = page
    paint(typeof raw.getTabBar === 'function' ? raw.getTabBar() : null)
    paint(raw.$vm && typeof raw.$vm.getTabBar === 'function' ? raw.$vm.getTabBar() : null)
  })
}

function place(index) {
  const width = wx.getSystemInfoSync().windowWidth || 375
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

Component({
  data: {
    selected: 0,
    open: false,
    travel: false,
    jelly: false,
    covered: false,
    indicator: 'opacity:0;',
    left: tabs.slice(0, 2),
    right: tabs.slice(2),
  },
  lifetimes: {
    attached() {
      const data = appData()
      data.tabBars = data.tabBars || []
      if (!data.tabBars.includes(this)) data.tabBars.push(this)
    },
    detached() {
      const data = appData()
      data.tabBars = (data.tabBars || []).filter((bar) => bar !== this)
    },
    ready() {
      this.showTab(resolveIndex(), false)
    },
  },
  pageLifetimes: {
    show() {
      const next = resolveIndex()
      if (next < 0) return
      this.showTab(next, false)
    },
  },
  methods: {
    showTab(index, animate) {
      if (index < 0 || index > 3) return
      this.apply(index, Boolean(animate))
    },
    mark(index) {
      const data = appData()
      data.tabIndex = index
      data.tabStamp = Date.now()
    },
    apply(index, animate) {
      if (this._travelTimer) clearTimeout(this._travelTimer)
      this.setData({
        selected: index,
        open: false,
        travel: Boolean(animate),
        indicator: place(index),
      })
      if (animate) {
        this._travelTimer = setTimeout(() => this.setData({ travel: false }), 240)
      }
      this.refine(index)
    },
    refine(index) {
      if (this._refineTimer) clearTimeout(this._refineTimer)
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
      }, 280)
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
    onTab(event) {
      const index = Number(event.currentTarget.dataset.index)
      const tab = tabs[index]
      if (!tab) return
      const route = getCurrentPages().slice(-1)[0]?.route || ''
      const same = index === this.data.selected && route.indexOf(tab.key) >= 0
      if (same) {
        this.setData({ open: false })
        this.bounce()
        return
      }
      this.mark(index)
      paintEveryBar(index, true)
      wx.switchTab({ url: tab.url })
    },
    toggle() {
      this.setData({ open: !this.data.open })
    },
    close() {
      this.setData({ open: false })
    },
    quick(event) {
      const kind = event.currentTarget.dataset.kind
      this.setData({ open: false })
      if (kind === 'add') {
        const data = appData()
        data.pendingAdd = true
        this.mark(0)
        paintEveryBar(0, false)
        wx.switchTab({ url: '/pages/today/index' })
        return
      }
      wx.navigateTo({ url: kind === 'course' ? '/pages/course-edit/index' : '/pages/expense-edit/index' })
    },
  },
})
