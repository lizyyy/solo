#!/bin/bash

# 城中村门牌归并重跑脚本
# 会话ID: SESS-DETOUR-20260607103240
# 生成时间: 2026-06-07 10:32:40

# 使用方法:
#   chmod +x 重跑命令_*.sh
#   ./重跑命令_*.sh

set -e

echo "开始重跑城中村门牌归并流程..."
echo "会话ID: SESS-DETOUR-20260607103240"

# [2026-06-07 10:32:40] python main.py import --session SESS-DETOUR-20260607103240
# [2026-06-07 10:32:40] # 已导入 1 条居民投诉记录
# [2026-06-07 10:32:40] python main.py review-photos --session SESS-DETOUR-20260607103240 --reviewer 周姐
# [2026-06-07 10:32:40] # 已审核 1 条路口照片
# [2026-06-07 10:32:40] python main.py update-points --session SESS-DETOUR-20260607103240
# [2026-06-07 10:32:40] # 点位清单更新完成，共处理 1 条记录

echo "归并流程重跑完成！"
echo "请查看 output/ 目录下的复盘记录"