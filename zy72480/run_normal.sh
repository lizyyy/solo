#!/bin/bash
cd "$(dirname "$0")"

echo "================================================"
echo "运行场景1: 正常材料（仅导入投诉）"
echo "用于演示: 居民投诉编号第一次导入"
echo "================================================"

python3 scripts/process_wait_time.py \
    data/raw/complaints_batch_001.json

echo ""
echo "✅ 场景1运行完成"
echo "   查看点位清单: output/points/points_list_final.json"
echo "   查看历史记录: output/history/ 目录下最新文件"
