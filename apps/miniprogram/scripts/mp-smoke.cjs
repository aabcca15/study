const path = require('node:path')

const root = path.resolve(process.argv[2] || 'dist/dev/mp-weixin')
const storage = new Map()
const calls = []
let appOptions = null
const registered = []
const pages = []

function noop() {}
const wxImpl = {
  getStorageSync: (k) => (storage.has(k) ? storage.get(k) : ''),
  setStorageSync: (k, v) => storage.set(k, v),
  removeStorageSync: (k) => storage.delete(k),
  setStorage: ({ key, data, success }) => { storage.set(key, data); success && success() },
  getSystemInfoSync: () => ({ statusBarHeight: 20, windowWidth: 375, windowHeight: 700, platform: 'devtools', SDKVersion: '3.17.2' }),
  getWindowInfo: () => ({ statusBarHeight: 20, windowWidth: 375, windowHeight: 700 }),
  getDeviceInfo: () => ({ platform: 'devtools' }),
  getAppBaseInfo: () => ({ SDKVersion: '3.17.2', language: 'zh_CN' }),
  getLaunchOptionsSync: () => ({ path: 'pages/login/index', query: {} }),
  getEnterOptionsSync: () => ({ path: 'pages/login/index', query: {} }),
  getAccountInfoSync: () => ({ miniProgram: { appId: 'touristappid' } }),
  getMenuButtonBoundingClientRect: () => ({ top: 24, height: 32, right: 365, width: 87 }),
}
for (const name of ['switchTab', 'reLaunch', 'navigateTo', 'redirectTo', 'showToast', 'showModal', 'setBackgroundColor', 'setBackgroundTextStyle', 'hideTabBar']) {
  wxImpl[name] = (opts = {}) => {
    calls.push([name, opts.url || opts.title || opts.content || ''])
    opts.success && opts.success({})
    opts.complete && opts.complete({})
  }
}
global.wx = new Proxy(wxImpl, {
  get(target, key) {
    if (key in target) return target[key]
    if (typeof key === 'string' && /^(on|off)[A-Z]/.test(key)) return noop
    if (typeof key === 'string' && key.startsWith('__')) return undefined
    return undefined
  },
})
global.App = (options) => { appOptions = options }
global.Page = (options) => registered.push({ kind: 'page', options })
global.Component = (options) => { registered.push({ kind: 'component', options }); return options }
global.getApp = () => appOptions
global.getCurrentPages = () => pages

function setPath(target, key, value) {
  const parts = key.replace(/\[(\d+)\]/g, '.$1').split('.')
  let node = target
  for (let i = 0; i < parts.length - 1; i += 1) {
    node[parts[i]] = node[parts[i]] ?? {}
    node = node[parts[i]]
  }
  node[parts[parts.length - 1]] = value
}

function instantiate(options, route) {
  const inst = {
    route,
    is: route,
    properties: {},
    data: JSON.parse(JSON.stringify(options.data || {})),
    setData(patch, cb) {
      for (const [k, v] of Object.entries(patch)) setPath(this.data, k, v)
      cb && cb()
    },
    triggerEvent() {},
    selectComponent() { return null },
    selectAllComponents() { return [] },
    createSelectorQuery() { return { in() { return this }, select() { return this }, boundingClientRect() { return this }, exec() {} } },
    getTabBar() { return null },
  }
  for (const [k, fn] of Object.entries(options.methods || {})) inst[k] = fn.bind(inst)
  if (route) pages.push(inst)
  options.lifetimes.attached.call(inst)
  options.lifetimes.ready && options.lifetimes.ready.call(inst)
  return inst
}

async function tap(inst, key, label) {
  const name = inst.data[key]
  if (typeof name !== 'string' || typeof inst[name] !== 'function') {
    throw new Error(`${label}: 没有绑定点击处理（data.${key}=${JSON.stringify(name)}）`)
  }
  inst[name]({ type: 'tap', target: { dataset: {} }, currentTarget: { dataset: {} }, detail: {} })
  await new Promise((r) => setTimeout(r, 20))
}

const errors = []
const origError = console.error
const origWarn = console.warn
console.error = (...a) => { errors.push(a.map(String).join(' ')); }
console.warn = (...a) => { errors.push(a.map(String).join(' ')); }

;(async () => {
  require(path.join(root, 'app.js'))
  if (!appOptions) throw new Error('App() 未被调用')
  appOptions.onLaunch && appOptions.onLaunch.call(appOptions, { path: 'pages/login/index', query: {} })

  require(path.join(root, 'components/ThemeToggle.js'))
  const toggleOpts = registered[registered.length - 1].options
  require(path.join(root, 'pages/login/index.js'))
  const loginOpts = registered[registered.length - 1].options

  const login = instantiate(loginOpts, 'pages/login/index')
  login.onLoad && login.onLoad({})
  login.onShow && login.onShow()
  instantiate(toggleOpts, '')

  const report = []
  report.push(`初始 mode 绑定: create=${login.data.b} join=${login.data.d} 按钮文字=${login.data.j}`)
  await tap(login, 'e', '加入家庭标签')
  report.push(`点「加入家庭」后: join=${login.data.d} 提交按钮=${login.data.q}`)
  await tap(login, 'c', '创建家庭标签')
  report.push(`点「创建家庭」后: create=${login.data.b} 按钮文字=${login.data.j}`)
  await tap(login, 'l', '创建并进入')
  await new Promise((r) => setTimeout(r, 50))
  report.push(`点「创建并进入」后的跳转/提示: ${JSON.stringify(calls)}`)

  for (const route of ['pages/today/index', 'pages/calendar/index', 'pages/courses/index', 'pages/stats/index', 'pages/family/index']) {
    const before = errors.length
    require(path.join(root, route + '.js'))
    const opts = registered[registered.length - 1].options
    const page = instantiate(opts, route)
    page.onLoad && page.onLoad({})
    page.onShow && page.onShow()
    await new Promise((r) => setTimeout(r, 20))
    const keys = Object.keys(page.data).length
    report.push(`${route}: 渲染字段 ${keys} 个，新增错误 ${errors.length - before} 条`)
  }

  console.log(report.join('\n'))
  console.log('错误/警告:\n' + (errors.length ? errors.join('\n---\n') : '无'))
})().catch((e) => {
  console.log('崩溃:', e && e.stack || e)
  console.log('错误/警告:\n' + errors.join('\n---\n'))
  process.exitCode = 1
})
