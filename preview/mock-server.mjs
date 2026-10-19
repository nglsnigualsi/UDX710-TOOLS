/**
 * 预览用 Mock 后端 —— 只为验证前端界面，数据格式对齐 src/ 里真实处理函数
 * 用法: node preview/mock-server.mjs [port]
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST = path.join(__dirname, '..', 'web', 'dist')
const PORT = Number(process.argv[2] || 6688)

const json = (res, obj, code = 200) => {
  const body = JSON.stringify(obj)
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store'
  })
  res.end(body)
}

/* ---- 构造 SPENGMD 工程模式返回：行用 '-' 分隔，逗号分列，末尾 OK ---- */
function buildAt(rows) {
  return rows.map(r => r.map(v => String(v)).join(',')).join('-') + '-OK\r\n'
}
function zeros(n) { return Array.from({ length: n }, () => Array(8).fill(0)) }

/* NR: band41 / arfcn 504990 / pci 123 / rsrp -95.00 / rsrq -12.00 / sinr@15 25.00 */
const nrRows = zeros(20)
nrRows[0][0] = 41; nrRows[1][0] = 504990; nrRows[2][0] = 123
nrRows[3][0] = -9500; nrRows[4][0] = -1200; nrRows[15][0] = 2500
/* LTE: band3 / earfcn 1650 / pci 301 / rsrp -105.00 / rsrq -15.00 / sinr@33 12.00 */
const lteRows = zeros(36)
lteRows[0][0] = 3; lteRows[1][0] = 1650; lteRows[2][0] = 301
lteRows[3][0] = -10500; lteRows[4][0] = -1500; lteRows[33][0] = 1200

const AT_MAP = {
  'AT+SPENGMD=0,6,0': buildAt(lteRows),
  'AT+SPENGMD=0,14,1': buildAt(nrRows),
}

const SYSTEM_INFO = {
  hostname: 'UDX710-MiFi', sysname: 'Linux', release: '5.10.104',
  version: '#1 SMP PREEMPT aarch64', machine: 'aarch64',
  total_ram: 245, free_ram: 96, cached_ram: 41,
  cpu_usage: 12.4, uptime: 187342.5,
  bridge_status: 'up', sim_slot: 'slot1', signal_strength: '4',
  thermal_temp: 42.5, power_status: 'Discharging', battery_health: 'Good',
  battery_capacity: 76, ssid: 'UDX710-5G', passwd: '1234567890',
  select_network_mode: '5G/4G auto', is_activated: 1,
  serial: 'UDX71020260412A1B2C', network_mode: '5G NSA',
  airplane_mode: false,
  imei: '867512030123456', iccid: '89860012345678901234', imsi: '460001234567890',
  carrier: '中国移动', network_type: '5G NSA', network_band: 'B3+N41',
  qci: 9, downlink_rate: 320, uplink_rate: 68
}

function route(url, method, body) {
  const u = url.split('?')[0]

  /* 认证 */
  if (u === '/api/auth/status') return { logged_in: true, auth_required: true }
  if (u === '/api/auth/login') return { status: 'success', message: '登录成功', token: 'preview-token' }
  if (u === '/api/auth/logout') return { status: 'ok' }
  if (u === '/api/auth/password') return { status: 'ok', message: '密码修改成功' }

  if (u === '/api/info') return SYSTEM_INFO
  if (u === '/api/at') {
    const cmd = (body && body.command) || ''
    const out = AT_MAP[cmd]
    return out
      ? { Code: 0, Error: '', Data: out }
      : { Code: 0, Error: '', Data: 'OK\r\n' }
  }
  if (u === '/api/current_band') {
    return {
      Code: 0, Error: '',
      Data: {
        network_type: '5G NSA', band: 'B3+N41', arfcn: 504990, pci: 123,
        rsrp: -95.0, rsrq: -12.0, sinr: 25.0
      }
    }
  }
  if (u === '/api/security/status') return { status: 'ok', data: { is_set: true, created_at: 1776000000 } }
  if (u === '/api/security/questions') return { status: 'ok', data: { question1: '你的第一辆车？', question2: '母亲的生日？' } }

  if (u === '/api/data') {
    if (method === 'POST') return { status: 'ok', message: 'Success', data: { active: true } }
    return { status: 'ok', message: 'Success', data: { active: true } }
  }
  if (u === '/api/roaming') {
    if (method === 'POST') return { status: 'ok', message: 'Success', data: { roaming_allowed: true, is_roaming: false } }
    return { status: 'ok', message: 'Success', data: { roaming_allowed: true, is_roaming: false } }
  }

  if (u === '/api/get/Total') return { rx: '18.42 GB', tx: '3.71 GB', total: '22.13 GB' }
  if (u === '/api/get/set') return { much: 107374182400, switch: 1 }
  if (u === '/api/get/first-reboot') return { enabled: true, day: ['1', '2', '3', '4', '5'], hour: 3, minute: 30 }
  if (u === '/api/get/time') return { time: new Date().toISOString(), timezone: 'CST-8' }
  if (u === '/api/set/time') return { success: true, msg: '时间同步成功' }

  if (u === '/api/charge/config') {
    return {
      Code: 0, Error: '',
      Data: {
        config: { enabled: true, startThreshold: 20, stopThreshold: 80 },
        battery: {
          capacity: 76, charging: false, status: 'Discharging', health: 'Good',
          temperature: 31.5, voltage: 3.92, current: -0.42
        }
      }
    }
  }

  if (u === '/api/bands') {
    const mk = (arr) => arr.map(([name, label]) => ({ name, label, locked: false }))
    return {
      '4G_TDD': mk([['TDD_34', 'B34'], ['TDD_38', 'B38'], ['TDD_39', 'B39'], ['TDD_40', 'B40'], ['TDD_41', 'B41']]),
      '4G_FDD': mk([['FDD_01', 'B1'], ['FDD_03', 'B3'], ['FDD_05', 'B5'], ['FDD_08', 'B8']]),
      '5G': mk([['N01', 'N1'], ['N08', 'N8'], ['N28', 'N28'], ['N41', 'N41'], ['N77', 'N77'], ['N78', 'N78'], ['N79', 'N79']])
    }
  }
  if (u === '/api/cells') {
    return {
      Code: 0, Error: '',
      Data: [
        { type: '5G', band: 'N41', arfcn: 504990, pci: 123, rsrp: -95.0, rsrq: -12.0, sinr: 25.0, primary: 1 },
        { type: '4G', band: 'B3', arfcn: 1650, pci: 301, rsrp: -105.0, rsrq: -15.0, sinr: 12.0, primary: 1 }
      ]
    }
  }

  if (u === '/api/netif/list') {
    return {
      interfaces: [
        { name: 'eth0', hwaddr: '00:1e:64:aa:bb:cc', inet_addr: '192.168.0.1', inet6_addr: '2409:8a00::1', mask: '255.255.255.0', is_up: true, monitoring: true },
        { name: 'usb0', hwaddr: '02:1e:64:dd:ee:ff', inet_addr: '192.168.42.1', inet6_addr: '', mask: '255.255.255.0', is_up: true, monitoring: false },
        { name: 'rmnet0', hwaddr: '', inet_addr: '10.32.45.18', inet6_addr: '2409:8a00::2', mask: '255.255.255.0', is_up: true, monitoring: false }
      ]
    }
  }
  if (u === '/api/netif/stats') {
    return { ifname: (body && body.interface) || 'eth0', rx_bytes: 12034567890, tx_bytes: 3456789012, rx_rate: 45200, tx_rate: 12300 }
  }

  if (u === '/api/usb/mode') {
    if (method === 'POST') return { Code: 0, Error: '', Data: { mode: (body && body.mode) || 'RNDIS', mode_value: 3, is_temporary: false } }
    return { Code: 0, Error: '', Data: { mode: 'RNDIS', mode_value: 3, is_temporary: false } }
  }
  if (u === '/api/usb-advance') return { Code: 0, Error: '', Data: { mode: 'CDC-ECM', mode_value: 1 } }

  if (u === '/api/apn/config') {
    return {
      status: 'ok', message: '', mode: 0, template_id: 1, auto_start: 1,
      template: { id: 1, name: '中国移动', apn: 'cmnet', protocol: 'IPV4V6', username: '', password: '' },
      templates: [
        { id: 1, name: '中国移动', apn: 'cmnet', protocol: 'IPV4V6' },
        { id: 2, name: '中国联通', apn: '3gnet', protocol: 'IPV4V6' },
        { id: 3, name: '中国电信', apn: 'ctnet', protocol: 'IPV4V6' }
      ]
    }
  }
  if (u === '/api/apn/templates') {
    return {
      status: 'ok',
      templates: [
        { id: 1, name: '中国移动', apn: 'cmnet', protocol: 'IPV4V6' },
        { id: 2, name: '中国联通', apn: '3gnet', protocol: 'IPV4V6' },
        { id: 3, name: '中国电信', apn: 'ctnet', protocol: 'IPV4V6' }
      ]
    }
  }

  if (u === '/api/sms') {
    return [
      { id: 1, sender: '10086', content: '【中国移动】您本月已使用流量 18.42GB，剩余 81.58GB。', timestamp: '2026-04-12T09:15:00', read: false },
      { id: 2, sender: '10658123', content: '【验证码】您的验证码为 384752，5 分钟内有效。', timestamp: '2026-04-12T08:42:00', read: true }
    ]
  }
  if (u === '/api/sms/config') return { max_count: 50, max_sent_count: 10, sms_fix_enabled: 0 }
  if (u === '/api/sms/webhook') return { enabled: false, platform: 'custom', url: '', body: '', headers: '' }
  if (u === '/api/sms/webhook/logs') return { logs: [] }
  if (u === '/api/sms/sent') return []

  if (u === '/api/plugins') return { Code: 0, Error: '', Data: [], Count: 0 }
  if (u === '/api/plugins/all') return { Code: 0, Error: '', Data: [], Count: 0 }
  if (u === '/api/scripts') return { Code: 0, Error: '', Data: [], Count: 0 }

  if (u === '/api/rathole/config') return { status: 'ok', data: { server_addr: '', token: '', autostart: 0 } }
  if (u === '/api/rathole/services') return { status: 'ok', data: [] }
  if (u === '/api/rathole/status') return { status: 'ok', data: { running: false, connected: false } }
  if (u === '/api/rathole/logs') return { status: 'ok', data: { logs: [] } }

  if (u === '/api/ipv6-proxy/config') return { status: 'ok', data: { enabled: false, webhook_url: '', autostart: 0 } }
  if (u === '/api/ipv6-proxy/rules') return { status: 'ok', data: [] }
  if (u === '/api/ipv6-proxy/status') return { status: 'ok', data: { running: false, ipv6_addr: '' } }
  if (u === '/api/ipv6-proxy/send-logs') return { status: 'ok', data: [] }

  if (u === '/api/update/version') return { current_version: '2.3.4', latest_version: '2.3.5', has_update: true, url: '', changelog: '预览模式', size: 0, required: false }
  if (u === '/api/update/check') return { current_version: '2.3.4', latest_version: '2.3.5', has_update: true, url: '', changelog: '预览模式：仅为界面演示', size: 0, required: false }

  if (u === '/api/phone-case') {
    if (method === 'POST') return { status: 'ok', data: { enabled: !!(body && body.enabled) } }
    return { status: 'ok', data: { enabled: false } }
  }
  if (u === '/api/device_control') return { status: 'ok', message: 'Reboot command sent' }
  if (u === '/api/clear_cache') return { status: 'ok', message: 'Cache cleared successfully' }
  if (u === '/api/airplane_mode') return { status: 'ok', message: 'Success' }
  if (u === '/api/serial') return { serial: 'UDX71020260412A1B2C' }

  /* 默认：空成功响应，保证界面不报错 */
  return { status: 'ok', message: 'preview', Code: 0, Error: '', Data: null }
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf' }

const server = http.createServer((req, res) => {
  const url = req.url || '/'

  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*', 'Access-Control-Max-Age': '86400' })
    return res.end()
  }

  if (url.startsWith('/api/')) {
    let raw = ''
    req.on('data', c => { raw += c })
    req.on('end', () => {
      let body = null
      try { body = raw ? JSON.parse(raw) : null } catch { body = null }
      const u = url.split('?')[0]
      console.log(`[mock] ${req.method} ${u}`)
      json(res, route(url, req.method, body))
    })
    return
  }

  /* 静态文件（SPA 回退到 index.html） */
  let rel = decodeURIComponent(url.split('?')[0])
  if (rel === '/') rel = '/index.html'
  let file = path.join(DIST, rel)
  if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    file = path.join(DIST, 'index.html')
  }

  /* 预览便利：注入登录态，直接进入主面板，跳过密码与密保设置 */
  if (path.basename(file) === 'index.html') {
    const q = new URL(url, 'http://x').searchParams
    const dual = q.get('dual') === '0' ? '0' : '1'   // ?dual=0 看原版单频段模式
    const tab = q.get('tab') || 'monitor'
    let html = fs.readFileSync(file, 'utf8')
    html = html.replace('</head>', `<script>
      localStorage.setItem('auth_token','preview-token');
      localStorage.setItem('monitor_dualband_enabled','${dual}');
      localStorage.setItem('preview_tab','${tab}');
    </script></head>`)
    res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store' })
    return res.end(html)
  }

  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' })
  fs.createReadStream(file).pipe(res)
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`预览服务已启动: http://127.0.0.1:${PORT}/  (mock 后端 + web/dist)`)
})
