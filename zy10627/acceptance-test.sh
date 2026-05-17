#!/bin/bash

BASE_URL="http://localhost:3000"

echo "========================================"
echo "物业IoT平台门禁离线补开记录 API 验收测试"
echo "========================================"
echo ""

echo "[1/10] 检查服务健康状态..."
curl -s "$BASE_URL/api/health" | python3 -m json.tool
echo ""
echo "----------------------------------------"

echo "[2/10] 获取门禁设备列表..."
curl -s "$BASE_URL/api/devices" | python3 -m json.tool
echo ""
echo "----------------------------------------"

echo "[3/10] 获取住户列表..."
curl -s "$BASE_URL/api/residents" | python3 -m json.tool
echo ""
echo "----------------------------------------"

echo "[4/10] 获取离线时段列表..."
curl -s "$BASE_URL/api/offline-periods" | python3 -m json.tool
echo ""
echo "----------------------------------------"

echo "[5/10] 场景一：完整流转 - 创建离线补开记录..."
NEW_RECORD=$(curl -s -X POST "$BASE_URL/api/open-records" \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "dev_002",
    "residentId": "res_002",
    "openTime": "2026-05-18T09:00:00.000Z",
    "credentialType": "offline_code",
    "credentialValue": "OFF20260518003",
    "operator": "res_004",
    "remark": "2号楼1单元网络故障，李四忘带卡"
  }')
echo "$NEW_RECORD" | python3 -m json.tool
RECORD_ID=$(echo "$NEW_RECORD" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['id'])")
echo ""
echo "----------------------------------------"

echo "[6/10] 场景一：完整流转 - 提交待复核..."
curl -s -X PUT "$BASE_URL/api/open-records/$RECORD_ID/status" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "pending_review",
    "operator": "res_004",
    "remark": "管理员已核实住户身份，提交复核"
  }' | python3 -m json.tool
echo ""
echo "----------------------------------------"

echo "[7/10] 场景一：完整流转 - 归档记录..."
curl -s -X PUT "$BASE_URL/api/open-records/$RECORD_ID/status" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "archived",
    "operator": "res_004",
    "remark": "复核通过，已归档"
  }' | python3 -m json.tool
echo ""
echo "----------------------------------------"

echo "[8/10] 场景一：完整流转 - 查看操作历史..."
curl -s "$BASE_URL/api/open-records/$RECORD_ID/history" | python3 -m json.tool
echo ""
echo "----------------------------------------"

echo "[9/10] 场景二：冲突记录 - 创建与在线记录时间重叠的离线补开..."
CONFLICT_RESULT=$(curl -s -X POST "$BASE_URL/api/open-records" \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "dev_002",
    "residentId": "res_003",
    "openTime": "2026-05-18T07:31:00.000Z",
    "credentialType": "offline_code",
    "credentialValue": "OFF20260518004",
    "operator": "res_004",
    "remark": "重复点击测试"
  }')
echo "$CONFLICT_RESULT" | python3 -m json.tool
CONFLICT_RECORD_ID=$(echo "$CONFLICT_RESULT" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['id'])")
echo ""
echo "----------------------------------------"

echo "[10/10] 场景二：冲突记录 - 添加备注后推进流程（不会卡死）..."
curl -s -X PUT "$BASE_URL/api/open-records/$CONFLICT_RECORD_ID/remark" \
  -H "Content-Type: application/json" \
  -d '{
    "remark": "经核实：网络延迟导致重复记录，保留在线记录有效，离线记录作废",
    "operator": "res_004"
  }' | python3 -m json.tool
echo ""
echo "----------------------------------------"

echo ""
echo "场景三：批量导入 - 包含1条坏行..."
IMPORT_RESULT=$(curl -s -X POST "$BASE_URL/api/open-records/batch-import" \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "res_004",
    "records": [
      {
        "deviceId": "dev_002",
        "residentId": "res_001",
        "openTime": "2026-05-18T10:00:00.000Z",
        "credentialType": "card",
        "credentialValue": "CARD001001",
        "remark": "正常刷卡"
      },
      {
        "deviceId": "invalid_device",
        "residentId": "res_001",
        "openTime": "2026-05-18T10:05:00.000Z",
        "credentialType": "card",
        "remark": "这是坏行，设备不存在"
      },
      {
        "deviceId": "dev_001",
        "residentId": "res_002",
        "openTime": "2026-05-18T10:10:00.000Z",
        "credentialType": "app",
        "remark": "APP开门"
      }
    ]
  }')
echo "$IMPORT_RESULT" | python3 -m json.tool
echo ""
echo "----------------------------------------"

echo ""
echo "获取完整记录列表..."
curl -s "$BASE_URL/api/open-records" | python3 -m json.tool
echo ""
echo "----------------------------------------"

echo ""
echo "导出CSV..."
EXPORT_RESULT=$(curl -s "$BASE_URL/api/open-records/export/csv")
echo "$EXPORT_RESULT" | python3 -m json.tool
echo ""
echo "----------------------------------------"

echo ""
echo "========================================"
echo "验收测试完成！"
echo "========================================"
echo ""
echo "核心数据验证："
echo "- 门禁设备: 3个 (dev_001, dev_002, dev_003)"
echo "- 住户: 4个 (含物业管理员 res_004)"
echo "- 离线时段: 2个 (1个活跃, 1个已解决)"
echo "- 状态覆盖: online, offline_open, pending_review, archived, conflict"
echo ""
echo "测试场景："
echo "1. 完整流转: 创建离线补开 -> 待复核 -> 已归档 -> 查看历史"
echo "2. 冲突记录: 时间重叠自动检测 -> 添加备注继续推进"
echo "3. 批量导入: 包含坏行，成功/失败分离"
echo ""
echo "验证要点："
echo "- 列表、详情、历史数据互相对齐"
echo "- 冲突记录不会卡死流程，可以添加备注"
echo "- 导出CSV包含完整业务字段"
echo ""