/**
 * 用无头 Chrome 对预览页面截图
 * 用法: node preview/shoot.mjs <url> <out.png> [width] [height]
 */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs'
import path from 'node:path'

const pexec = promisify(execFile)

const url = process.argv[2] || 'http://127.0.0.1:6688/'
const out = process.argv[3] || '/tmp/shot.png'
const width = parseInt(process.argv[4] || '390', 10)
const height = parseInt(process.argv[5] || '844', 10)

const BIN = '/opt/chrome-hs/chrome-headless-shell-linux64/chrome-headless-shell'

const args = [
  '--headless',
  '--no-sandbox',
  '--disable-gpu',
  '--disable-dev-shm-usage',
  '--hide-scrollbars',
  `--window-size=${width},${height}`,
  '--virtual-time-budget=9000',
  `--screenshot=${out}`,
  url
]

fs.mkdirSync(path.dirname(out), { recursive: true })
const { stderr } = await pexec(BIN, args, { maxBuffer: 32 * 1024 * 1024, timeout: 120000 }).catch(e => ({ stderr: String(e.stderr || e.message) }))

if (fs.existsSync(out)) {
  const kb = (fs.statSync(out).size / 1024).toFixed(1)
  console.log(`OK ${out} (${kb} KB, ${width}x${height})`)
} else {
  console.log('FAILED\n' + String(stderr).slice(-1500))
}
