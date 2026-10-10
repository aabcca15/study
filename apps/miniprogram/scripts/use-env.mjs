// 编译前按环境改写 project.config.json：miniprogramRoot 指向本次输出目录，appid 用 .env 里的 WX_APPID。
// 用法：node scripts/use-env.mjs <development|production> <dev|build>
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const mode = process.argv[2] === 'production' ? 'production' : 'development'
const out = process.argv[3] === 'build' ? 'build' : 'dev'

function readEnv(file) {
  const values = {}
  if (!fs.existsSync(file)) return values
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (match) values[match[1]] = match[2].replace(/^["']|["']$/g, '')
  }
  return values
}

const envFile = path.join(root, `.env.${mode}`)
const env = {
  ...readEnv(path.join(root, '.env')),
  ...readEnv(envFile),
  ...readEnv(path.join(root, `.env.${mode}.local`)),
}
if (!fs.existsSync(envFile)) console.warn(`[env] 没有找到 ${path.basename(envFile)}，按空配置继续`)

function updateJson(file, change) {
  const json = JSON.parse(fs.readFileSync(file, 'utf8'))
  change(json)
  fs.writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`)
}

const appid = env.WX_APPID || ''
const miniprogramRoot = `dist/${out}/mp-weixin/`

// 清掉上次的输出，避免已删除或已移到分包的旧页面、旧图片还留在包里。
fs.rmSync(path.join(root, miniprogramRoot), { recursive: true, force: true })

updateJson(path.join(root, 'project.config.json'), (json) => {
  json.miniprogramRoot = miniprogramRoot
  if (appid) json.appid = appid
})

updateJson(path.join(root, 'src/manifest.json'), (json) => {
  json['mp-weixin'] = json['mp-weixin'] || {}
  if (appid) json['mp-weixin'].appid = appid
})

console.log(`[env] ${env.VITE_APP_ENV || mode} · miniprogramRoot=${miniprogramRoot} · appid=${appid || '(未填，沿用原值)'} · cloud=${env.VITE_CLOUD_ENV || '(未填，用开发者工具当前环境)'}`)
if (mode === 'production' && !env.VITE_CLOUD_ENV) {
  console.warn('[env] 正式包没有填写 VITE_CLOUD_ENV。上线前请在 apps/miniprogram/.env.production 填正式云环境 ID。')
}
