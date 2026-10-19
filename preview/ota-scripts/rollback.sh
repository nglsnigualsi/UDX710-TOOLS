#!/bin/sh
# ============================================================
# UDX710-TOOLS 手动回退脚本
#
# 用途：新版出问题时，从 ttyd(7681) 或串口一键恢复到上一版本
# 用法：/home/root/6677/rollback.sh
# ============================================================

DIR="/home/root/6677"
cd "$DIR" || exit 1

LOG="$DIR/update.log"

log_msg() {
  echo "$1"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [rollback] $1" >> "$LOG" 2>/dev/null
}

if [ ! -f "$DIR/server.bak" ]; then
  log_msg "错误：未找到 server.bak，无法回退"
  exit 1
fi

log_msg "===== 手动回退开始 ====="

# 停止当前进程（只结束本目录下的 server）
for p in $(ps 2>/dev/null | grep "$DIR/server" | grep -v grep | awk '{print $1}'); do
  kill "$p" 2>/dev/null
done
sleep 1

# 还原 server
rm -f "$DIR/server"
cp -f "$DIR/server.bak" "$DIR/server"
chmod 755 "$DIR/server"
log_msg "已还原 server"

# 还原 dist
if [ -d "$DIR/dist.bak" ]; then
  rm -rf "$DIR/dist"
  cp -rf "$DIR/dist.bak" "$DIR/dist"
  log_msg "已还原 dist"
fi

# 清除回退标记，使下次启动仍可自检
rm -f "$DIR/.rollback_done" 2>/dev/null

# 重新启动
./server &
sleep 3

if kill -0 $! 2>/dev/null; then
  log_msg "回退完成，server 已启动"
else
  log_msg "回退完成，但 server 未能启动，请检查日志 $LOG"
fi

exit 0
