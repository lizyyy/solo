#!/bin/bash
set -e

cd "$(dirname "$0")"

BASE_DIR=$(pwd)
LOG_DIR="$BASE_DIR/logs"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_FILE="$LOG_DIR/run_all_${TIMESTAMP}.log"

echo "=============================================="
echo "券商两融维保提醒 - 交互式分步演示"
echo "=============================================="
echo ""
echo "执行时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "日志文件: $LOG_FILE"
echo ""

mkdir -p "$LOG_DIR"

echo "[1/5] 清理之前的处理结果..."
rm -f "$BASE_DIR/data/processed/"*.csv
rm -f "$BASE_DIR/reports/"*.md
rm -f "$BASE_DIR/reports/"*.json
echo "  ✓ 已清理"
echo ""
echo "  按 Enter 继续运行正常材料..."
read

echo "[2/5] 运行: 正常材料 (BIZ20260601003按旧口径，无差异)..."
python3 "$BASE_DIR/scripts/run_workflow.py" normal 2>&1 | tee -a "$LOG_FILE"
echo ""
echo "  ✓ 正常材料处理完成"
echo ""
echo "  按 Enter 继续运行错口径材料..."
read

echo "[3/5] 运行: 错口径材料 (BIZ20260601003按新税率400，补录后修正为320)..."
python3 "$BASE_DIR/scripts/run_workflow.py" wrong 2>&1 | tee -a "$LOG_FILE"
echo ""
echo "  ✓ 错口径材料处理完成"
echo ""
echo "  按 Enter 继续运行补录材料..."
read

echo "[4/5] 运行: 补录材料..."
python3 "$BASE_DIR/scripts/run_workflow.py" supplement 2>&1 | tee -a "$LOG_FILE"
echo ""
echo "  ✓ 补录材料处理完成"
echo ""
echo "  按 Enter 继续运行合并报告..."
read

echo "[5/5] 生成三种材料合并报告..."
python3 "$BASE_DIR/scripts/run_workflow.py" combined 2>&1 | tee -a "$LOG_FILE"
echo ""
echo "  ✓ 合并报告已生成"

echo ""
echo "=============================================="
echo "所有流程执行完毕！"
echo "=============================================="
echo ""
echo "📁 各材料独立处理结果:"
ls -1 "$BASE_DIR/data/processed/"*.csv 2>/dev/null | while read f; do echo "  - $(basename "$f")"; done
echo ""
echo "📁 合并报告:"
ls -1t "$BASE_DIR/reports/"combined_*.md 2>/dev/null | head -1 | while read f; do echo "  - $(basename "$f")"; done
ls -1t "$BASE_DIR/reports/"combined_*.json 2>/dev/null | head -1 | while read f; do echo "  - $(basename "$f")"; done
echo ""
echo "🔄 快速重跑命令:"
echo "  python3 scripts/run_workflow.py combined   # 三种材料合并运行（推荐）"
echo "  bash run_quick.sh                          # 快速全量重跑"
echo "  bash run_all.sh                            # 本脚本（交互式）"
