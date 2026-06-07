#!/bin/bash
cd "$(dirname "$0")"

echo "================================================"
echo "运行场景3: 补录材料（完整三步流程）"
echo "用于演示: 导入投诉 → 补看照片 → 人工修正 → 更新点位"
echo "================================================"

python3 scripts/process_wait_time.py \
    data/raw/complaints_batch_001.json \
    data/photos/photo_records.json \
    data/raw/manual_correction_001.json

echo ""
echo "✅ 场景3运行完成"
echo "   三种处理结果已呈现:"
echo "   1. XK-007: 顺利记录 → 状态:正常"
echo "   2. RM-012: 施工临时改道未同步 → 状态:待居民代表复核"
echo "   3. HP-004: 从路口照片补来旧口径 → 状态:已补录修正"
echo ""
echo "   查看点位清单: output/points/points_list_final.json"
echo "   查看历史记录: output/history/ 目录下最新文件"
