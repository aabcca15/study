const tabs = [
  { key: 'today', text: '今日', icon: '/static/icons/clock-muted.png', iconOn: '/static/icons/clock-accent.png', url: '/pages/today/index' },
  { key: 'calendar', text: '日历', icon: '/static/icons/calendar-muted.png', iconOn: '/static/icons/calendar-accent.png', url: '/pages/calendar/index' },
  { key: 'courses', text: '课程', icon: '/static/icons/book-muted.png', iconOn: '/static/icons/book-accent.png', url: '/pages/courses/index' },
  { key: 'stats', text: '统计', icon: '/static/icons/bars-muted.png', iconOn: '/static/icons/bars-accent.png', url: '/pages/stats/index' },
]

Component({
  data: {
    selected: 0,
    open: false,
    travel: false,
    jelly: false,
    indicator: 'opacity:0;',
    left: tabs.slice(0, 2),
    right: tabs.slice(2),
  },
  lifetimes: {
    ready() {
      this.sync(false)
    },
  },
  pageLifetimes: {
    show() {
      this.sync(true)
    },
  },
  methods: {
    sync(animate) {
      if (this._lockUntil && Date.now() < this._lockUntil) {
        this.setData({ selected: this._lockIndex })
        this.measure(this._lockIndex)
        return
      }
      const pages = getCurrentPages()
      const route = pages[pages.length - 1]?.route || ''
      let selected = 0
      if (route.includes('calendar')) selected = 1
      else if (route.includes('courses')) selected = 2
      else if (route.includes('stats')) selected = 3
      const moved = selected !== this.data.selected
      this.setData({ selected, travel: Boolean(animate && moved) }, () => this.measure(selected))
      if (animate && moved) {
        setTimeout(() => this.setData({ travel: false }), 240)
      }
    },
    measure(index) {
      const selected = typeof index === 'number' ? index : this.data.selected
      const run = () => {
        const query = this.createSelectorQuery()
        query.select('#glass-tabbar').boundingClientRect()
        query.selectAll('.tab').boundingClientRect()
        query.exec((res) => {
          const bar = res?.[0]
          const tab = res?.[1]?.[selected]
          if (!bar?.width || !tab?.width) return
          this.setData({
            indicator: `left:${tab.left - bar.left}px;top:${tab.top - bar.top}px;width:${tab.width}px;height:${tab.height}px;opacity:1;`,
          })
        })
      }
      wx.nextTick(run)
      setTimeout(run, 320)
    },
    bounce() {
      this.setData({ jelly: false })
      wx.nextTick(() => {
        this.setData({ jelly: true })
        setTimeout(() => this.setData({ jelly: false }), 480)
      })
    },
    onTab(event) {
      const index = Number(event.currentTarget.dataset.index)
      const tab = tabs[index]
      if (!tab) return
      const route = getCurrentPages().slice(-1)[0]?.route || ''
      const same = index === this.data.selected && route.includes(tab.key)
      if (same) {
        this.setData({ open: false })
        this.bounce()
        return
      }
      this._lockIndex = index
      this._lockUntil = Date.now() + 800
      this.setData({ open: false, selected: index, travel: true, jelly: false }, () => this.measure(index))
      setTimeout(() => this.setData({ travel: false }), 240)
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
        const app = getApp()
        app.globalData = app.globalData || {}
        app.globalData.pendingAdd = true
        this.setData({ selected: 0 })
        wx.switchTab({ url: '/pages/today/index' })
        return
      }
      wx.navigateTo({ url: kind === 'course' ? '/pages/course-edit/index' : '/pages/expense-edit/index' })
    },
  },
})
