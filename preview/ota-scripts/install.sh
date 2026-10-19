#!/bin/sh
# ============================================================
# UDX710-TOOLS OTA 安装脚本（含备份与回退支持）
#
# 相比原版增加：
#   1. 安装前把当前 server / dist 备份为 .bak（可随时回退）
#   2. 部署开机自检守护：新版起不来会自动回退到 .bak
#   3. 部署手动回退脚本 rollback.sh（供 ttyd 使用）
#
# 安装流程与原版保持一致：删除旧文件 → 拷贝新文件
# ============================================================

# 定义路径变量
DEST_rathole="/home/root/6677/rathole"
OLD_SERVER="/home/root/6677/server"
OLD_DIST="/home/root/6677/dist"
NEW_SERVER="/tmp/update/server"
NEW_rathole="/tmp/update/rathole"
NEW_DIST="/tmp/update/dist"
DEST_SERVER="/home/root/6677/server"
DEST_DIST="/home/root/6677/dist"

# 备份与日志
BAK_SERVER="/home/root/6677/server.bak"
BAK_DIST="/home/root/6677/dist.bak"
LOG="/home/root/6677/update.log"

log_msg() {
  echo "$1"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG"
}

log_msg "===== OTA 更新开始 ====="

# ------------------------------------------------------------
# 1. 备份当前版本
# ------------------------------------------------------------
rm -rf "$BAK_SERVER"
rm -rf "$BAK_DIST"

if [ -f "$OLD_SERVER" ]; then
  if cp -f "$OLD_SERVER" "$BAK_SERVER"; then
    log_msg "已备份 server -> server.bak"
  else
    log_msg "警告：server 备份失败"
  fi
else
  log_msg "警告：未找到旧 server，跳过备份"
fi

if [ -d "$OLD_DIST" ]; then
  if cp -rf "$OLD_DIST" "$BAK_DIST"; then
    log_msg "已备份 dist -> dist.bak"
  else
    log_msg "警告：dist 备份失败"
  fi
else
  log_msg "警告：未找到旧 dist，跳过备份"
fi

# ------------------------------------------------------------
# 2. 安装新版本（与原版流程一致）
# ------------------------------------------------------------
rm -rf "${OLD_SERVER}"
rm -rf "${OLD_DIST}"

cp -rf "${NEW_SERVER}" "${DEST_SERVER}"
chmod 775 "${DEST_SERVER}"

# rathole 仅在本次升级包内包含时才覆盖；增量包通常不带它，保持设备上现有版本
if [ -f "${NEW_rathole}" ]; then
  cp -rf "${NEW_rathole}" "${DEST_rathole}"
  chmod 775 "${DEST_rathole}"
  log_msg "已更新 rathole"
else
  log_msg "升级包未包含 rathole，保留设备现有版本"
fi

cp -rf "${NEW_DIST}" "${DEST_DIST}"

# 清除上一轮的回退标记，让新版本获得一次自检与回退机会
rm -f /home/root/6677/.rollback_done 2>/dev/null

# ------------------------------------------------------------
# 3. 部署开机自检守护与手动回退脚本
# ------------------------------------------------------------
if [ -f /tmp/update/start.sh ]; then
  cp -f /tmp/update/start.sh /home/root/6677/start.sh
  chmod 755 /home/root/6677/start.sh
  log_msg "已部署开机自检守护 start.sh"
fi

if [ -f /tmp/update/rollback.sh ]; then
  cp -f /tmp/update/rollback.sh /home/root/6677/rollback.sh
  chmod 755 /home/root/6677/rollback.sh
  log_msg "已部署手动回退脚本 rollback.sh"
fi

log_msg "操作完成：更新成功（备份保留在 server.bak / dist.bak）"
exit 0
