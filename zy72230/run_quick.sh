#!/bin/bash
set -e

cd "$(dirname "$0")"

BASE_DIR=$(pwd)
LOG_DIR="$BASE_DIR/logs"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_FILE="$LOG_DIR/run_quick_${TIMESTAMP}.log"

echo "=============================================="
echo "券商两融维保提醒 - 快速演示 (三种材料合并)"
echo "=============================================="
echo ""

mkdir -p "$LOG_DIR"

echo "清理历史结果..."
rm -f "$BASE_DIR/data/processed/"*.csv
rm -f "$BASE_DIR/reports/"*.md
rm -f "$BASE_DIR/reports/"*.json
echo "✓ 已清理"
echo ""

echo "▶︎ 运行: 三种材料合并运行 (combined)..."
python3 "$BASE_DIR/scripts/run_workflow.py" combined >> "$LOG_FILE" 2>&1
RESULT=$?

if [ $RESULT -eq 0 ]; then
    echo "  ✓ 三种材料合并运行完成"
else
    echo "  ✗ 运行失败，请查看日志: $LOG_FILE"
    exit 1
fi

echo ""
echo "=============================================="
echo "✓ 全部完成！日志: $LOG_FILE"
echo "=============================================="
echo ""
echo "📁 处理结果文件:"
ls -1 "$BASE_DIR/data/processed/"*.csv 2>/dev/null | while read f; do echo "  - $(basename "$f")"; done
echo ""
echo "📁 报告文件:"
ls -1t "$BASE_DIR/reports/"*.md 2>/dev/null | while read f; do echo "  - $(basename "$f")"; done
ls -1t "$BASE_DIR/reports/"*.json 2>/dev/null | while read f; do echo "  - $(basename "$f")"; done
echo ""
echo "🔄 重跑命令:"
echo "  bash run_quick.sh                            # 快速全量重跑"
echo "  bash run_all.sh                              # 交互式分步演示"
echo "  python3 scripts/run_workflow.py combined     # 三种材料合并运行"
echo "  python3 scripts/run_workflow.py normal       # 仅正常材料"
echo "  python3 scripts/run_workflow.py wrong        # 仅错口径材料"
echo "  python3 scripts/run_workflow.py supplement   # 仅补录材料"
