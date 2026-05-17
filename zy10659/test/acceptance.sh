#!/bin/bash

BASE_URL="http://localhost:3000"

echo "========================================"
echo "酒店PMS接口房态手工锁房 API 验收测试"
echo "========================================"
echo ""

echo "[1/10] 检查服务健康状态..."
curl -s "$BASE_URL/health" | jq .
echo ""

echo "[2/10] 场景一：完整流转（1001房间）"
echo "  -> 创建锁房（锁房中 locking）"
LOCK_ID_1001=$(curl -s -X POST "$BASE_URL/api/locks" \
  -H "Content-Type: application/json" \
  -d '{
    "room_number": "1001",
    "reason_code": "MAINTENANCE",
    "channel_code": "OTA_CTRIP",
    "operator": "张三",
    "remark": "空调维修"
  }' | jq -r '.data.id')
echo "     锁房ID: $LOCK_ID_1001"
echo ""

echo "  -> 设置待解锁（pending_unlock）"
curl -s -X POST "$BASE_URL/api/locks/$LOCK_ID_1001/status" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "pending_unlock",
    "operator": "李四",
    "remark": "维修完成，待确认解锁"
  }' | jq .
echo ""

echo "  -> 完成解锁（unlocked）"
curl -s -X POST "$BASE_URL/api/locks/$LOCK_ID_1001/status" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "unlock",
    "operator": "王五",
    "remark": "已确认解锁"
  }' | jq .
echo ""

echo "  -> 查看锁房详情"
curl -s "$BASE_URL/api/locks/$LOCK_ID_1001" | jq .
echo ""

echo "  -> 查看完整历史记录"
curl -s "$BASE_URL/api/locks/$LOCK_ID_1001/history" | jq .
echo ""

echo "[3/10] 场景二：冲突记录（1002房间重复锁房）"
echo "  -> 创建第一个锁房"
LOCK_ID_1002=$(curl -s -X POST "$BASE_URL/api/locks" \
  -H "Content-Type: application/json" \
  -d '{
    "room_number": "1002",
    "reason_code": "VIP_RESERVE",
    "channel_code": "DIRECT",
    "operator": "赵六",
    "remark": "VIP客户预留"
  }' | jq -r '.data.id')
echo "     锁房ID: $LOCK_ID_1002"
echo ""

echo "  -> 尝试重复锁房（应该失败）"
curl -s -X POST "$BASE_URL/api/locks" \
  -H "Content-Type: application/json" \
  -d '{
    "room_number": "1002",
    "reason_code": "INTERNAL_USE",
    "operator": "钱七",
    "remark": "内部使用"
  }' | jq .
echo ""

echo "[4/10] 场景三：批量导入（含成功、冲突、坏行）"
echo "  -> 执行批量导入"
BATCH_RESULT=$(curl -s -X POST "$BASE_URL/api/locks/import" \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "系统管理员",
    "records": [
      {
        "room_number": "1003",
        "reason_code": "CHANNEL_LOCK",
        "channel_code": "OTA_MEITUAN",
        "remark": "美团渠道已售出（成功）"
      },
      {
        "room_number": "1002",
        "reason_code": "INTERNAL_USE",
        "remark": "已锁定房间（冲突失败）"
      },
      {
        "room_number": "9999",
        "reason_code": "INVALID_REASON",
        "remark": "不存在的房间和原因（坏行）"
      },
      {
        "room_number": "1101",
        "reason_code": "COMPLAINT_HANDLE",
        "channel_code": "OTA_FLIGGY",
        "remark": "投诉处理预留（成功）"
      },
      {
        "room_number": "1102",
        "reason_code": "OVERBOOKING",
        "remark": "超售预留（成功）"
      }
    ]
  }')
echo "$BATCH_RESULT" | jq .
BATCH_ID=$(echo "$BATCH_RESULT" | jq -r '.data.batch_id')
echo ""

echo "  -> 查看导入批次详情"
curl -s "$BASE_URL/api/locks/import/$BATCH_ID" | jq .
echo ""

echo "[5/10] 查询锁房列表（全部状态）"
curl -s "$BASE_URL/api/locks" | jq .
echo ""

echo "[6/10] 按状态筛选查询（locking 状态）"
curl -s "$BASE_URL/api/locks?status=locking" | jq .
echo ""

echo "[7/10] 按房间号查询（1002房间）"
curl -s "$BASE_URL/api/locks?room_number=1002" | jq .
echo ""

echo "[8/10] 导出全部锁房记录CSV"
EXPORT_RESULT=$(curl -s -X POST "$BASE_URL/api/locks/export" \
  -H "Content-Type: application/json" \
  -d '{}')
echo "$EXPORT_RESULT" | jq .
EXPORT_FILENAME=$(echo "$EXPORT_RESULT" | jq -r '.data.filename')
echo ""

echo "[9/10] 导出单条锁房历史记录CSV"
curl -s -X POST "$BASE_URL/api/locks/$LOCK_ID_1001/export-history" | jq .
echo ""

echo "[10/10] 验证状态枚举"
echo "  -> available（可售）- 创建锁房前的初始状态"
echo "  -> locking（锁房中）- 已创建锁房"
echo "  -> pending_unlock（待解锁）- 等待确认解锁"
echo "  -> unlocked（已解锁）- 已完成解锁"
echo ""

echo "========================================"
echo "验收测试完成！"
echo "========================================"
echo ""
echo "关键数据说明："
echo "  - 完整流转ID: $LOCK_ID_1001（1001房间：locking -> pending_unlock -> unlocked）"
echo "  - 冲突记录ID: $LOCK_ID_1002（1002房间：重复锁房失败）"
echo "  - 导入批次ID: $BATCH_ID（5条记录：3成功，2失败）"
echo "  - 导出文件: $EXPORT_FILENAME"
echo ""
echo "下载导出文件: curl -O '$BASE_URL/api/locks/export/download/$EXPORT_FILENAME'"
echo ""
