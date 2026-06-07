#!/bin/bash
cd "$(dirname "$0")"

echo "================================================"
echo "运行场景2: 错口径材料（导入投诉+补看照片）"
echo "用于演示: 发现施工改道未同步、发现旧口径"
echo "================================================"

python3 scripts/process_wait_time.py \
    data/raw/complaints_batch_001.json \
    data/photos/photo_records.json

echo ""
echo "✅ 场景2运行完成"
echo "   注意: 施工临时改道未同步的记录仍保持'待居民代表复核'状态"
echo "   查看点位清单: output/points/points_list_final.json"
echo "   查看历史记录: output/history/ 目录下最新文件"
