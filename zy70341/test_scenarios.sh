#!/bin/bash

BASE_URL="http://localhost:5001/api/v1"

echo "======================================="
echo "  交易风控灰名单 API - 测试脚本"
echo "======================================="
echo ""

echo "检查服务健康状态..."
curl -s "${BASE_URL}/../health" | python3 -m json.tool
echo ""

echo "======================================="
echo "【场景1】羊毛党用户 - 交易被限额"
echo "======================================="
echo ""

echo "1. 写入羊毛党风险事件..."
curl -s -X POST "${BASE_URL}/risk-events" \
  -H "Content-Type: application/json" \
  -d '{
    "event_id": "evt_bot_001",
    "user_id": "user_002",
    "risk_type": "bot_detection",
    "severity": "medium",
    "description": "检测到自动化脚本行为，短时间内连续注册多账号",
    "evidence": {"ip_count": 5, "device_fingerprint_similarity": 0.95, "signup_interval_sec": 2, "total_signups": 20},
    "source": "bot_detection_engine"
  }' | python3 -m json.tool
echo ""

echo "2. 将用户加入灰名单（单笔限额1000，日限额5000）..."
curl -s -X POST "${BASE_URL}/graylist" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_002",
    "trigger_event_id": "evt_bot_001",
    "reason": "检测到机器人行为，临时限额观察",
    "single_transaction_limit": 1000,
    "daily_transaction_limit": 5000
  }' | python3 -m json.tool
echo ""

echo "3. 尝试交易500元（应允许）..."
curl -s -X POST "${BASE_URL}/transactions/evaluate" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_002",
    "amount": 500
  }' | python3 -m json.tool
echo ""

echo "4. 尝试交易1500元（应被限额，超出单笔限额）..."
curl -s -X POST "${BASE_URL}/transactions/evaluate" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_002",
    "amount": 1500
  }' | python3 -m json.tool
echo ""

echo "5. 查询用户风险时间线..."
curl -s "${BASE_URL}/users/user_002/risk-timeline" | python3 -m json.tool
echo ""

echo "======================================="
echo "【场景2】误报用户 - 人工复核后解除"
echo "======================================="
echo ""

echo "1. 写入VPN异常风险事件..."
curl -s -X POST "${BASE_URL}/risk-events" \
  -H "Content-Type: application/json" \
  -d '{
    "event_id": "evt_fp_001",
    "user_id": "user_004",
    "risk_type": "ip_anomaly",
    "severity": "medium",
    "description": "VPN IP检测到异常登录",
    "evidence": {"ip": "103.123.45.67", "vpn_detected": true},
    "source": "ip_analytics"
  }' | python3 -m json.tool
echo ""

echo "2. 将用户加入灰名单..."
curl -s -X POST "${BASE_URL}/graylist" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_004",
    "trigger_event_id": "evt_fp_001",
    "reason": "VPN IP异常登录",
    "single_transaction_limit": 2000,
    "daily_transaction_limit": 10000
  }' | python3 -m json.tool
echo ""

echo "3. 查询灰名单详情（客服解释用）..."
curl -s "${BASE_URL}/graylist/user_004" | python3 -m json.tool
echo ""

echo "4. 人工复核通过，解除灰名单限制..."
curl -s -X POST "${BASE_URL}/users/user_004/review" \
  -H "Content-Type: application/json" \
  -d '{
    "decision": "approve",
    "reviewer_id": "reviewer_001",
    "remark": "核实为用户出差使用公司VPN，属于误报，解除限制",
    "evidence": {
      "corporate_vpn_verified": true,
      "employee_id_match": "emp_12345",
      "travel_expense_record": "TRV-2026-0510"
    }
  }' | python3 -m json.tool
echo ""

echo "5. 复核后再次查询风险时间线（保留解除依据）..."
curl -s "${BASE_URL}/users/user_004/risk-timeline" | python3 -m json.tool
echo ""

echo "6. 复核后交易试算（应允许大额交易）..."
curl -s -X POST "${BASE_URL}/transactions/evaluate" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_004",
    "amount": 50000
  }' | python3 -m json.tool
echo ""

echo "======================================="
echo "【场景3】严重风险 - 升级黑名单"
echo "======================================="
echo ""

echo "1. 写入盗刷风险事件..."
curl -s -X POST "${BASE_URL}/risk-events" \
  -H "Content-Type: application/json" \
  -d '{
    "event_id": "evt_fraud_001",
    "user_id": "user_003",
    "risk_type": "fraud_suspected",
    "severity": "high",
    "description": "疑似信用卡盗刷，异地大额交易",
    "evidence": {"transaction_amount": 50000, "location": "北京", "user_history_location": "上海"},
    "source": "fraud_detection"
  }' | python3 -m json.tool
echo ""

echo "2. 先加入灰名单观察（更严格限额：单笔100，日500）..."
curl -s -X POST "${BASE_URL}/graylist" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_003",
    "trigger_event_id": "evt_fraud_001",
    "reason": "疑似信用卡盗刷",
    "single_transaction_limit": 100,
    "daily_transaction_limit": 500
  }' | python3 -m json.tool
echo ""

echo "3. 核实后升级为黑名单..."
curl -s -X POST "${BASE_URL}/users/user_003/review" \
  -H "Content-Type: application/json" \
  -d '{
    "decision": "escalate",
    "reviewer_id": "reviewer_002",
    "remark": "经核实，确认为信用卡盗刷案件，升级至黑名单",
    "evidence": {
      "card_holder_report": "Yes",
      "police_report_filed": "Case-2026-0512-001",
      "unusual_activity_pattern": "confirmed"
    }
  }' | python3 -m json.tool
echo ""

echo "4. 黑名单用户交易试算（应完全禁止）..."
curl -s -X POST "${BASE_URL}/transactions/evaluate" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_003",
    "amount": 1
  }' | python3 -m json.tool
echo ""

echo "======================================="
echo "【场景4】重复风险事件 - 幂等处理"
echo "======================================="
echo ""

echo "1. 第一次写入事件..."
curl -s -X POST "${BASE_URL}/risk-events" \
  -H "Content-Type: application/json" \
  -d '{
    "event_id": "evt_idempotent_001",
    "user_id": "user_005",
    "risk_type": "device_anomaly",
    "severity": "medium",
    "description": "测试幂等事件",
    "evidence": {"test": true},
    "source": "test"
  }' | python3 -m json.tool
echo ""

echo "2. 第二次写入相同event_id（应返回is_duplicate: true）..."
curl -s -X POST "${BASE_URL}/risk-events" \
  -H "Content-Type: application/json" \
  -d '{
    "event_id": "evt_idempotent_001",
    "user_id": "user_005",
    "risk_type": "device_anomaly",
    "severity": "medium",
    "description": "测试幂等事件",
    "evidence": {"test": true},
    "source": "test"
  }' | python3 -m json.tool
echo ""

echo "======================================="
echo "【场景5】查询每日风控效果统计"
echo "======================================="
echo ""

echo "查询今日风控统计..."
curl -s "${BASE_URL}/stats/daily" | python3 -m json.tool
echo ""

echo "======================================="
echo "  测试脚本执行完毕"
echo "======================================="
