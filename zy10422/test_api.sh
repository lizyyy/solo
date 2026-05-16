#!/bin/bash

BASE_URL="http://localhost:8099/api/v1"

echo "=== 设备可信证据API测试脚本 ==="
echo ""

echo "1. 健康检查"
curl -s http://localhost:8080/health | python3 -m json.tool
echo ""
echo ""

echo "2. 创建证据 - 成功案例（device-001 + 正确固件版本）"
curl -s -X POST "$BASE_URL/evidences" \
  -H "Content-Type: application/json" \
  -H "Idempotent-Key: test-001-$(date +%s)" \
  -d '{
    "device_id": "device-001",
    "firmware_version": "v1.2.0",
    "proof_material": {
      "hash": "7a8f9d2c",
      "signatures": ["sig1", "sig2"],
      "certificate": "cert-001-valid",
      "timestamp": 1700000000,
      "measurements": ["m1", "m2", "m3"]
    },
    "strategy_result": {
      "passed": true,
      "rules": [
        {"rule_id": "r1", "rule_name": "完整性校验", "passed": true, "details": "通过"},
        {"rule_id": "r2", "rule_name": "签名验证", "passed": true, "details": "通过"}
      ],
      "risk_level": "low",
      "recommended_action": "none"
    }
  }' | python3 -m json.tool
echo ""
echo ""

echo "3. 创建证据 - 待复核（未知设备）"
curl -s -X POST "$BASE_URL/evidences" \
  -H "Content-Type: application/json" \
  -H "Idempotent-Key: test-002-$(date +%s)" \
  -d '{
    "device_id": "device-999",
    "firmware_version": "v1.0.0",
    "proof_material": {
      "hash": "7a8f9d2c",
      "signatures": ["sig1"],
      "certificate": "cert-999",
      "timestamp": 1700000001,
      "measurements": ["m1"]
    },
    "strategy_result": {
      "passed": true,
      "rules": [
        {"rule_id": "r1", "rule_name": "完整性校验", "passed": true, "details": "通过"}
      ],
      "risk_level": "medium",
      "recommended_action": "none"
    }
  }' | python3 -m json.tool
echo ""
echo ""

echo "4. 创建证据 - 被拦截（策略不通过）"
curl -s -X POST "$BASE_URL/evidences" \
  -H "Content-Type: application/json" \
  -H "Idempotent-Key: test-003-$(date +%s)" \
  -d '{
    "device_id": "device-002",
    "firmware_version": "v2.0.0",
    "proof_material": {
      "hash": "7a8f9d2c",
      "signatures": ["sig1"],
      "certificate": "cert-002",
      "timestamp": 1700000002,
      "measurements": ["m1"]
    },
    "strategy_result": {
      "passed": false,
      "rules": [
        {"rule_id": "r1", "rule_name": "完整性校验", "passed": false, "details": "发现异常修改"},
        {"rule_id": "r2", "rule_name": "签名验证", "passed": true, "details": "通过"}
      ],
      "risk_level": "high",
      "recommended_action": "quarantine"
    }
  }' | python3 -m json.tool
echo ""
echo ""

echo "5. 创建证据 - 证明材料校验失败（哈希不匹配）"
curl -s -X POST "$BASE_URL/evidences" \
  -H "Content-Type: application/json" \
  -H "Idempotent-Key: test-004-$(date +%s)" \
  -d '{
    "device_id": "device-001",
    "firmware_version": "v1.2.0",
    "proof_material": {
      "hash": "invalid_hash",
      "signatures": ["sig1"],
      "certificate": "cert-001",
      "timestamp": 1700000003,
      "measurements": ["m1"]
    }
  }' | python3 -m json.tool
echo ""
echo ""

echo "6. 查询证据列表（第1页，每页10条）"
curl -s -X POST "$BASE_URL/evidences/query" \
  -H "Content-Type: application/json" \
  -d '{"page": 1, "page_size": 10}' | python3 -m json.tool
echo ""
echo ""

echo "7. 幂等性测试（重复提交相同的Idempotent-Key）"
IDEMPOTENT_KEY="test-idempotent-$(date +%s)"
echo "第一次提交:"
curl -s -X POST "$BASE_URL/evidences" \
  -H "Content-Type: application/json" \
  -H "Idempotent-Key: $IDEMPOTENT_KEY" \
  -d '{
    "device_id": "device-003",
    "firmware_version": "v1.5.0",
    "proof_material": {
      "hash": "7a8f9d2c",
      "signatures": ["sig1"],
      "certificate": "cert-003",
      "timestamp": 1700000004,
      "measurements": ["m1"]
    }
  }' | python3 -m json.tool
echo ""
echo "第二次提交（应该返回相同结果）:"
curl -s -X POST "$BASE_URL/evidences" \
  -H "Content-Type: application/json" \
  -H "Idempotent-Key: $IDEMPOTENT_KEY" \
  -d '{
    "device_id": "device-003",
    "firmware_version": "v1.5.0",
    "proof_material": {
      "hash": "7a8f9d2c",
      "signatures": ["sig1"],
      "certificate": "cert-003",
      "timestamp": 1700000004,
      "measurements": ["m1"]
    }
  }' | python3 -m json.tool
echo ""
echo ""

echo "=== 测试完成 ==="
echo ""
echo "后续可测试的接口:"
echo "- GET  /api/v1/evidences/{id}       - 获取单个证据详情"
echo "- PUT  /api/v1/evidences/{id}/status - 更新证据状态"
echo "- PUT  /api/v1/evidences/{id}/correct - 人工修正"
echo "- GET  /api/v1/evidences/export     - 导出所有证据"
echo "- GET  /api/v1/evidences/{id}/report - 生成证据报告"
