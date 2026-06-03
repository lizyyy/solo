#!/bin/bash
set -e

cd "$(dirname "$0")"

echo "=============================================="
echo "券商两融维保提醒 - 快速演示 (无交互)"
echo "=============================================="
echo ""

BASE_DIR=$(pwd)
SCRIPT_DIR="$BASE_DIR/scripts"
LOG_DIR="$BASE_DIR/logs"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_FILE="$LOG_DIR/run_quick_${TIMESTAMP}.log"

mkdir -p "$LOG_DIR"

echo "清理历史结果..."
rm -f "$BASE_DIR/data/processed/"*.csv
rm -f "$BASE_DIR/reports/"*.md
rm -f "$BASE_DIR/reports/"*.json
echo "✓ 已清理"
echo ""

echo "▶︎ 运行1/3: 正常材料..."
python3 "$SCRIPT_DIR/run_workflow.py" normal >> "$LOG_FILE" 2>&1
echo "  ✓ 正常材料完成"

echo "▶︎ 运行2/3: 错口径材料..."
python3 "$SCRIPT_DIR/run_workflow.py" wrong >> "$LOG_FILE" 2>&1
echo "  ✓ 错口径材料完成"

echo "▶︎ 运行3/3: 补录材料..."
python3 "$SCRIPT_DIR/run_workflow.py" supplement >> "$LOG_FILE" 2>&1
echo "  ✓ 补录材料完成"

echo ""
echo "=============================================="
echo "✓ 全部完成！日志: $LOG_FILE"
echo "=============================================="
echo ""
echo "最新差异报告:"
ls -t "$BASE_DIR/reports/"*.md | head -1 | awk '{print "  " $0}'
echo ""
echo "最新历史记录:"
ls -t "$BASE_DIR/reports/"*.json | head -1 | awk '{print "  " $0}'
echo ""
echo "重跑命令:"
echo "  bash run_quick.sh   # 快速全量重跑"
echo "  bash run_all.sh     # 交互式分步演示"
