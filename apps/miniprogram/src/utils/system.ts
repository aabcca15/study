let statusBar: number | undefined

/** 状态栏高度在一次运行中不会变，读一次就够了。 */
export function statusBarHeight() {
  if (statusBar === undefined) {
    const info = typeof uni.getWindowInfo === 'function' ? uni.getWindowInfo() : uni.getSystemInfoSync()
    statusBar = info.statusBarHeight || 20
  }
  return statusBar
}
