#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PKG_DIR="$(dirname "$SCRIPT_DIR")"
SAMPLE_DIR="$SCRIPT_DIR/sample_data"
OUTPUT_DIR="$SCRIPT_DIR/output"

echo "=== 现场多轨命名整理 — 快速开始 ==="
echo

echo "[Step 1] 生成样例多轨文件..."
python -m live_track_organizer.examples.generate_sample

echo
echo "[Step 2] 运行整理 (dry-run 预览)..."
python -m live_track_organizer "$SAMPLE_DIR" "$OUTPUT_DIR" \
    --channel-table "$SAMPLE_DIR/channel_table.txt" \
    --part-assignment "$SAMPLE_DIR/part_assignment.txt" \
    --dry-run

echo
echo "[Step 3] 正式运行整理 + 复制文件..."
python -m live_track_organizer "$SAMPLE_DIR" "$OUTPUT_DIR" \
    --channel-table "$SAMPLE_DIR/channel_table.txt" \
    --part-assignment "$SAMPLE_DIR/part_assignment.txt"

echo
echo "完成! 查看结果:"
echo "  整理后文件: $OUTPUT_DIR"
echo "  明细报告:   $OUTPUT_DIR/organize_report_*.txt"
echo "  JSON报告:   $OUTPUT_DIR/organize_report_*.json"
