#!/bin/bash

# 城中村门牌归并重跑脚本
# 会话ID: TEST-REPLAY
# 生成时间: 2026-06-13 00:34:52

# 使用方法:
#   chmod +x 重跑命令_*.sh
#   ./重跑命令_*.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$SCRIPT_DIR"

echo "============================================================"
echo "  城中村门牌归并 - 重跑流程"
echo "============================================================"
echo "  会话ID: TEST-REPLAY"
echo "  会话名称: 测试重跑会话"
echo "============================================================"

python3 main.py import --session TEST-REPLAY --data all
echo "  [导入] 已载入 3 条居民投诉记录"
python3 main.py review-photos --session TEST-REPLAY --data all --reviewer 周姐
echo "  [审核] 周姐 已审核 3 张路口照片"
python3 main.py update-points --session TEST-REPLAY
echo "  [更新点位] 已归并1条，已补录1条，待复核1条，冲突0条"

python3 main.py generate-report --session TEST-REPLAY

echo "============================================================"
echo "  归并流程重跑完成！结果统计："
echo "    点位总数: 2"
echo "    已归并:   1 条"
echo "    已补录:   1 条"
echo "    待复核:   1 条"
echo "    冲突待确认: 0 条"
echo "------------------------------------------------------------"
echo "  复盘记录:   output/复盘记录_TEST-REPLAY_*.md"
echo "  会话存档:   sessions/TEST-REPLAY.json"
echo "============================================================"