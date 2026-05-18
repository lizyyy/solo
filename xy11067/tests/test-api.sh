#!/bin/bash

BASE_URL="http://localhost:3000/api"

echo "=========================================="
echo "  托育园保健室晨检隔离 API 测试脚本"
echo "=========================================="
echo ""

echo "[1/8] 测试服务健康检查..."
curl -s "$BASE_URL/health" | python3 -m json.tool
echo ""
echo "-----------------------------------------"
echo ""

echo "[2/8] 测试单条晨检录入 - 正常儿童..."
curl -s -X POST "$BASE_URL/health-check/single" \
  -H "Content-Type: application/json" \
  -d '{
    "child_id": "C20240001",
    "check_date": "2024-05-18",
    "check_time": "08:10:00",
    "checker_name": "李医生",
    "body_temperature": 36.5,
    "has_fever": 0,
    "cough": 0,
    "runny_nose": 0,
    "spirit_status": "良好",
    "appetite_status": "良好",
    "sleep_status": "良好",
    "is_allowed_entry": 1,
    "check_result": "正常",
    "remarks": "晨检无异常"
  }' | python3 -m json.tool
echo ""
echo "-----------------------------------------"
echo ""

echo "[3/8] 测试单条晨检录入 - 发热儿童 (触发兄妹提醒)..."
curl -s -X POST "$BASE_URL/health-check/single" \
  -H "Content-Type: application/json" \
  -d '{
    "child_id": "C20240002",
    "check_date": "2024-05-18",
    "check_time": "08:15:00",
    "checker_name": "李医生",
    "body_temperature": 37.8,
    "has_fever": 1,
    "cough": 1,
    "runny_nose": 1,
    "spirit_status": "一般",
    "appetite_status": "较差",
    "sleep_status": "较差",
    "is_allowed_entry": 0,
    "check_result": "隔离",
    "remarks": "发热伴咳嗽，建议隔离观察",
    "guardian_notified": 1,
    "notification_time": "2024-05-18 08:20:00"
  }' | python3 -m json.tool
echo ""
echo "-----------------------------------------"
echo ""

echo "[4/8] 测试批量晨检录入..."
curl -s -X POST "$BASE_URL/health-check/batch" \
  -H "Content-Type: application/json" \
  -d '{
    "records": [
      {
        "child_id": "C20240003",
        "check_date": "2024-05-18",
        "check_time": "08:20:00",
        "checker_name": "王医生",
        "body_temperature": 36.7,
        "has_fever": 0,
        "cough": 0,
        "runny_nose": 0,
        "spirit_status": "良好",
        "appetite_status": "良好",
        "sleep_status": "良好",
        "is_allowed_entry": 1,
        "check_result": "正常"
      },
      {
        "child_id": "C20240004",
        "check_date": "2024-05-18",
        "check_time": "08:25:00",
        "checker_name": "王医生",
        "body_temperature": 36.6,
        "has_fever": 0,
        "cough": 0,
        "runny_nose": 0,
        "spirit_status": "良好",
        "appetite_status": "良好",
        "sleep_status": "良好",
        "is_allowed_entry": 1,
        "check_result": "正常"
      }
    ]
  }' | python3 -m json.tool
echo ""
echo "-----------------------------------------"
echo ""

echo "[5/8] 测试单条隔离录入..."
curl -s -X POST "$BASE_URL/isolation/single" \
  -H "Content-Type: application/json" \
  -d '{
    "child_id": "C20240002",
    "start_date": "2024-05-18",
    "start_time": "08:30:00",
    "isolation_reason": "发热37.8℃，伴咳嗽流涕，疑似上呼吸道感染",
    "isolation_type": "临时观察",
    "isolation_location": "保健室隔离间",
    "symptoms": "发热、咳嗽、流涕",
    "diagnosis": "上呼吸道感染",
    "body_temperature": 37.8,
    "guardian_notified": 1,
    "notification_method": "电话",
    "notification_time": "2024-05-18 08:35:00",
    "checker_name": "李医生",
    "remarks": "家长已接回，建议居家观察3天"
  }' | python3 -m json.tool
echo ""
echo "-----------------------------------------"
echo ""

echo "[6/8] 查询当前活跃隔离列表..."
curl -s "$BASE_URL/isolation/active" | python3 -m json.tool
echo ""
echo "-----------------------------------------"
echo ""

echo "[7/8] 测试日报统计..."
curl -s "$BASE_URL/export/daily-report/2024-05-18" | python3 -m json.tool
echo ""
echo "-----------------------------------------"
echo ""

echo "[8/8] 测试导出晨检记录..."
curl -s "$BASE_URL/export/health-check/2024-05-18" | python3 -m json.tool
echo ""
echo "-----------------------------------------"
echo ""

echo "=========================================="
echo "  测试完成！"
echo "=========================================="
