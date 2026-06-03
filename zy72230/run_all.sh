#!/bin/bash
set -e

cd "$(dirname "$0")"

echo "=============================================="
echo "券商两融维保提醒 - 完整演示流程"
echo "=============================================="
echo ""

BASE_DIR=$(pwd)
SCRIPT_DIR="$BASE_DIR/scripts"
LOG_DIR="$BASE_DIR/logs"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_FILE="$LOG_DIR/run_all_${TIMESTAMP}.log"

echo "执行时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "日志文件: $LOG_FILE"
echo ""

mkdir -p "$LOG_DIR"

echo "[1/4] 清理之前的处理结果..."
rm -f "$BASE_DIR/data/processed/"*.csv
rm -f "$BASE_DIR/reports/"*.md
rm -f "$BASE_DIR/reports/"*.json
echo "  ✓ 已清理"
echo ""

echo "[2/4] 运行: 正常材料 (correct tax rate)..."
python3 "$SCRIPT_DIR/run_workflow.py" normal 2>&1 | tee -a "$LOG_FILE"
echo ""
echo "  ✓ 正常材料处理完成"
echo ""
echo "  按 Enter 继续运行错口径材料..."
read

echo "[3/4] 运行: 错口径材料 (wrong tax rate for BIZ20260601003)..."
python3 "$SCRIPT_DIR/run_workflow.py" wrong 2>&1 | tee -a "$LOG_FILE"
echo ""
echo "  ✓ 错口径材料处理完成"
echo ""
echo "  按 Enter 继续运行补录材料..."
read

echo "[4/4] 运行: 补录材料 (with supplement data)..."
python3 "$SCRIPT_DIR/run_workflow.py" supplement 2>&1 | tee -a "$LOG_FILE"
echo ""
echo "  ✓ 补录材料处理完成"
echo ""

echo "=============================================="
echo "所有流程执行完毕！"
echo "=============================================="
echo ""
echo "📁 生成的文件:"
echo ""
echo "  数据文件:"
ls -la "$BASE_DIR/data/processed/"*.csv 2>/dev/null | awk '{print "    - " $NF}' || echo "    (无)"
echo ""
echo "  报告文件:"
ls -la "$BASE_DIR/reports/"*.md 2>/dev/null | awk '{print "    - " $NF}' || echo "    (无)"
ls -la "$BASE_DIR/reports/"*.json 2>/dev/null | awk '{print "    - " $NF}' || echo "    (无)"
echo ""
echo "  日志文件:"
echo "    - $LOG_FILE"
echo ""
echo "=============================================="
echo "快速重跑命令:"
echo "  正常材料:   cd $BASE_DIR && python3 scripts/run_workflow.py normal"
echo "  错口径材料: cd $BASE_DIR && python3 scripts/run_workflow.py wrong"
echo "  补录材料:   cd $BASE_DIR && python3 scripts/run_workflow.py supplement"
echo "  全部重跑:   cd $BASE_DIR && bash run_all.sh"
echo "=============================================="
