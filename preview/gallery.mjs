/**
 * 用 puppeteer-core + 本地 headless_shell 批量截图各功能页
 * 用法: node preview/gallery.mjs [baseUrl] [outDir]
 */
import { createRequire } from 'node:module'
const require = createRequire('/tmp/')
const puppeteer = require('puppeteer-core')
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.argv[2] || 'http://127.0.0.1:6688/'
const OUT = process.argv[3] || '/root/Documents/deepseek-harness/default-workspace/UDX710-TOOLS/preview/shots'
const BIN = '/opt/chrome-arm/chrome-linux/headless_shell'

fs.mkdirSync(OUT, { recursive: true })

const browser = await puppeteer.launch({
  executablePath: BIN,
  headless: true,
  args: [
    '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--hide-scrollbars', '--disable-setuid-sandbox',
    '--font-render-hinting=none'
  ]
})

const page = await browser.newPage()
await page.setViewport({ width: 390, height: 900, deviceScaleFactor: 2 })

page.on('console', m => {
  const t = m.text()
  if (t.includes('error') || t.includes('Error') || t.includes('失败')) return
})

async function settle(ms = 1800) {
  await new Promise(r => setTimeout(r, ms))
}

async function goto(url) {
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 })
  await settle(2200)
}

/** 按菜单文案点击侧边栏项 */
async function clickMenu(label) {
  const clicked = await page.evaluate((txt) => {
    const btns = [...document.querySelectorAll('nav button')]
    for (const b of btns) {
      const s = b.querySelector('span')
      if (s && s.textContent.trim() === txt) { b.click(); return true }
    }
    return false
  }, label)
  if (!clicked) return false
  await settle(2000)
  return true
}

async function shoot(name, fullPage = false) {
  const file = path.join(OUT, name)
  await page.screenshot({ path: file, fullPage })
  const kb = (fs.statSync(file).size / 1024).toFixed(0)
  console.log(`  ✓ ${name} (${kb} KB)`)
}

const PAGES = [
  ['系统监控', '01-monitor.png'],
  ['网络管理', '02-network.png'],
  ['网络接口', '03-netif.png'],
  ['APN配置', '04-apn.png'],
  ['高级网络', '05-advanced.png'],
  ['短信管理', '06-sms.png'],
  ['流量统计', '07-traffic.png'],
  ['充电控制', '08-battery.png'],
  ['内网穿透', '09-rathole.png'],
  ['IPv6转发', '10-ipv6.png'],
  ['系统更新', '11-update.png'],
  ['AT调试', '12-at.png'],
  ['Web终端', '13-terminal.png'],
  ['USB模式', '14-usb.png'],
  ['插件商城', '15-plugins.png'],
  ['系统设置', '16-settings.png']
]

console.log('打开首页...')
await goto(BASE)

for (const [label, file] of PAGES) {
  const ok = await clickMenu(label)
  if (!ok) { console.log(`  ✗ 未找到菜单: ${label}`); continue }
  await shoot(file)
}

await browser.close()
console.log('\n完成，输出目录:', OUT)
