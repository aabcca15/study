import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = path.join(root, 'cloudfunctions')

for (const folder of ['dist/dev/mp-weixin', 'dist/build/mp-weixin']) {
  const targetRoot = path.join(root, folder)
  if (!fs.existsSync(targetRoot)) continue
  const target = path.join(targetRoot, 'cloudfunctions')
  fs.cpSync(source, target, {
    recursive: true,
    filter: (from) => !from.split(path.sep).includes('node_modules'),
  })
  console.log('copied cloud functions to', folder)
}
