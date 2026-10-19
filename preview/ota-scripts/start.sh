#!/bin/sh
# ============================================================
# UDX710-TOOLS 启动脚本（含启动自检与自动回退）
#
# 原版：cd /home/root/6677 && chmod 755 * && ./server &
#
# 本版增加：
#   1. 启动后自检：等待若干秒确认 server 存活
#   2. 若新版起不来，自动用 server.bak / dist.bak 回退
#   3. 回退只做一次（标记文件），避免坏备份导致无限重启
#
# 手动回退：直接执行 /home/root/6677/rollback.sh
# ============================================================

DIR="/home/root/6677"
cd "$DIR" || exit 1

chmod 755 * 2>/dev/null

LOG="$DIR/update.log"
MARK="$DIR/.rollback_done"
WAIT_SECONDS=6

log_msg() {
  echo "$1"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [start] $1" >> "$LOG" 2>/dev/null
}

# 启动 server，把 PID 记录到变量
SERVER_PID=""
start_server() {
  ./server &
  SERVER_PID=$!
}

# 等待并检查进程是否存活；存活返回 0，已退出返回 1
wait_alive() {
  _n=0
  while [ "$_n" -lt "$1" ]; do
    sleep 1
    if ! kill -0 "$SERVER_PID" 2>/dev/null; then
      return 1
    fi
    _n=$((_n + 1))
  done
  return 0
}

# 检查 dist 是否完整（至少要有入口文件）
dist_ok() {
  if [ -f "$DIR/dist/index.html" ]; then
    return 0
  fi
  return 1
}

# ------------------------------------------------------------
# 首次启动
# ------------------------------------------------------------
if [ ! -x "$DIR/server" ]; then
  log_msg "错误：server 不存在或不可执行"
fi

start_server

if wait_alive "$WAIT_SECONDS"; then
  # server 存活，再看前端是否完整
  if dist_ok; then
    log_msg "server 启动正常 (PID $SERVER_PID)"
    exit 0
  fi
  log_msg "server 存活但 dist 不完整，尝试回退前端"
  if [ -d "$DIR/dist.bak" ]; then
    rm -rf "$DIR/dist"
    cp -rf "$DIR/dist.bak" "$DIR/dist"
    log_msg "已回退 dist（server 保持不变，需重启页面）"
    exit 0
  fi
  log_msg "警告：无 dist.bak 可回退"
  exit 0
fi

# ------------------------------------------------------------
# 启动失败 → 自动回退
# ------------------------------------------------------------
log_msg "新版 server 启动失败（PID $SERVER_PID 已退出）"

if [ -f "$MARK" ]; then
  log_msg "已执行过回退，不再重复尝试（避免循环）。请检查 server.bak 是否有效"
  exit 1
fi

if [ ! -f "$DIR/server.bak" ]; then
  log_msg "无 server.bak，无法回退"
  exit 1
fi

touch "$MARK" 2>/dev/null
log_msg "开始自动回退到备份版本..."

rm -f "$DIR/server"
cp -f "$DIR/server.bak" "$DIR/server"
chmod 755 "$DIR/server"

if [ -d "$DIR/dist.bak" ]; then
  rm -rf "$DIR/dist"
  cp -rf "$DIR/dist.bak" "$DIR/dist"
fi

start_server

if wait_alive "$WAIT_SECONDS"; then
  log_msg "回退成功，已恢复到备份版本 (PID $SERVER_PID)"
else
  log_msg "回退后仍无法启动，请通过 ttyd(7681端口) 手动处理"
fi

exit 0
