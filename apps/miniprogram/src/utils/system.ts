let cached: { statusBar: number; windowWidth: number } | undefined

function readInfo() {
  if (!cached) {
    const info = typeof uni.getWindowInfo === 'function' ? uni.getWindowInfo() : uni.getSystemInfoSync()
    cached = {
      statusBar: info.statusBarHeight || 20,
      windowWidth: info.windowWidth || 375,
    }
  }
  return cached
}

/** 状态栏高度在一次运行中不会变，读一次就够了。 */
export function statusBarHeight() {
  return readInfo().statusBar
}

export function windowWidth() {
  return readInfo().windowWidth
}
