#!/bin/bash
# ========================================
# 冷链中转验收回放链路 API - 调用示例
# ========================================

BASE_URL="http://localhost:3000"

echo "========================================"
echo "冷链中转验收 API - HTTP 请求示例"
echo "服务地址: $BASE_URL"
echo "========================================"

echo ""
echo "📋 1. 提交正常批次数据"
echo 'curl -X POST "$BASE_URL/api/batches/submit" \'
echo '  -H "Content-Type: application/json" \'
echo '  -d {'
echo '    "batch_no": "BATCH-API-001",'
echo '    "driver_name": "张司机",'
echo '    "driver_phone": "13800138000",'
echo '    "operator": "api_user",'
echo '    "duplicate_strategy": "error",'
echo '    "boxes": ['
echo '      {"box_no": "BOX001", "original_box_no": "BOX001", "wms_expected_qty": 20, "actual_qty": 20},'
echo '      {"box_no": "BOX002", "original_box_no": "BOX002", "wms_expected_qty": 15, "actual_qty": 15}'
echo '    ],'
echo '    "temperature_records": ['
echo '      {"box_no": "BOX001", "record_time": "2024-01-15T10:00:00Z", "temperature": 4.5},'
echo '      {"box_no": "BOX001", "record_time": "2024-01-15T11:00:00Z", "temperature": 5.2}'
echo '    ],'
echo '    "photos": [{"photo_type": "driver", "file_name": "driver.jpg", "file_path": "/tmp/driver.jpg", "file_size": 123456}]'
echo '  }'
echo ""

echo "🔄 2. 重复提交 - 忽略策略"
echo 'curl -X POST "$BASE_URL/api/batches/submit" \'
echo '  -H "Content-Type: application/json" \'
echo '  -d {"batch_no": "BATCH-API-001", ... , "duplicate_strategy": "ignore"}'
echo ""

echo "🔄 3. 重复提交 - 覆盖策略"
echo 'curl -X POST "$BASE_URL/api/batches/submit" \'
echo '  -H "Content-Type: application/json" \'
echo '  -d {"batch_no": "BATCH-API-001", ... , "duplicate_strategy": "overwrite"}'
echo ""

echo "🔄 4. 重复提交 - 追加策略"
echo 'curl -X POST "$BASE_URL/api/batches/submit" \'
echo '  -H "Content-Type: application/json" \'
echo '  -d {"batch_no": "BATCH-API-001", "boxes": [...新增箱号...], "duplicate_strategy": "append"}'
echo ""

echo "↩️  5. 撤回批次"
echo 'curl -X POST "$BASE_URL/api/batches/1/withdraw" \'
echo '  -H "Content-Type: application/json" \'
echo '  -d {"operator": "operation_manager", "reason": "数据有误，需要修正"}'
echo ""

echo "↩️  6. 撤回后重新提交"
echo 'curl -X POST "$BASE_URL/api/batches/resubmit/BATCH-API-001" \'
echo '  -H "Content-Type: application/json" \'
echo '  -d {"operator": "api_user", "boxes": [...修正后的数据...]}'
echo ""

echo "✏️  7. 人工改判赔付金额"
echo 'curl -X POST "$BASE_URL/api/batches/1/adjust/compensation" \'
echo '  -H "Content-Type: application/json" \'
echo '  -d {'
echo '    "box_no": "BOX001",'
echo '    "new_compensation": 0,'
echo '    "reason": "复核确认免予赔付",'
echo '    "operator": "audit_manager"'
echo '  }'
echo ""

echo "❄️  8. 冻结批次（导出前）"
echo 'curl -X POST "$BASE_URL/api/batches/1/freeze" \'
echo '  -H "Content-Type: application/json" \'
echo '  -d {"operator": "export_operator"}'
echo ""

echo "📤 9. 导出批次数据"
echo 'curl -X POST "$BASE_URL/api/batches/1/export"'
echo ""

echo "📜 10. 查询操作历史"
echo 'curl "$BASE_URL/api/batches/1/history"'
echo ""

echo "📊 11. 查询所有批次"
echo 'curl "$BASE_URL/api/batches"'
echo ""

echo "🔍 12. 查询批次详情"
echo 'curl "$BASE_URL/api/batches/1"'
echo ""

echo "🎥 13. 获取回放原始数据"
echo 'curl "$BASE_URL/api/batches/1/replay"'
echo ""

echo "📷 14. 上传司机照片"
echo 'curl -X POST "$BASE_URL/api/batches/1/photo/upload" \'
echo '  -F "photo=@driver_photo.jpg" \'
echo '  -F "photo_type=driver" \'
echo '  -F "remark=司机交接照片"'
echo ""

echo "========================================"
echo "命令行工具使用示例:"
echo "  npm run seed          # 造数"
echo "  npm run acceptance    # 运行完整验收"
echo "  npm run history -- list      # 列出所有批次"
echo "  npm run history -- detail 1  # 查看批次详情"
echo "  npm run history -- history 1 # 查看操作历史"
echo "  npm start             # 启动API服务"
echo "========================================"
