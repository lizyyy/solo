#!/bin/bash

BASE_URL="http://localhost:3000"
echo "========================================"
echo "  用户导入撤销 API 完整流程演示"
echo "========================================"
echo ""

echo "=== 步骤 0: 检查服务健康 ==="
curl -s "$BASE_URL/health" | json_pp
echo ""
echo ""

echo "=== 步骤 1: 查看可用部门和角色 ==="
echo "--- 部门列表 ---"
curl -s "$BASE_URL/api/reference/departments" | json_pp
echo ""
echo "--- 角色列表 ---"
curl -s "$BASE_URL/api/reference/roles" | json_pp
echo ""
echo ""

echo "=== 步骤 2: 创建错误导入批次（故意映射错误的角色） ==="
echo "样例数据:"
echo "  - 新员工: 赵晓 (实习生角色) -> 错误映射为管理员"
echo "  - 新员工: 钱多多 (实习生角色) -> 错误映射为管理员"
echo "  - 老员工更新: 王刚 (原经理+开发) -> 错误映射为实习生"
echo "  - 部门缺失: 孙丽 (部门: 总裁办 -> 不存在)"
echo ""

CREATE_BATCH_RESPONSE=$(curl -s -X POST "$BASE_URL/api/import/batches" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "2026年5月新员工导入 (错误批次)",
    "creatorId": "admin-001",
    "users": [
      {
        "email": "zhaoxiao@company.com",
        "name": "赵晓",
        "departmentName": "技术部",
        "roleNames": ["管理员"]
      },
      {
        "email": "qianduoduo@company.com",
        "name": "钱多多",
        "departmentName": "运营部",
        "roleNames": ["管理员"]
      },
      {
        "email": "wanggang@company.com",
        "name": "王刚",
        "departmentName": "技术部",
        "roleNames": ["实习生"]
      },
      {
        "email": "sunli@company.com",
        "name": "孙丽",
        "departmentName": "总裁办",
        "roleNames": ["市场人员"]
      }
    ]
  }')

BATCH_ID=$(echo "$CREATE_BATCH_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['batch']['id'])")

echo "批次ID: $BATCH_ID"
echo ""
echo "创建结果:"
echo "$CREATE_BATCH_RESPONSE" | json_pp
echo ""
echo ""

echo "=== 步骤 3: 预检批次（查看警告） ==="
PRECHECK_RESPONSE=$(curl -s -X POST "$BASE_URL/api/import/batches/$BATCH_ID/precheck")
echo "$PRECHECK_RESPONSE" | json_pp
echo ""
echo ""

echo "=== 步骤 4: 确认导入（先导入看看效果） ==="
IMPORT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/import/batches/$BATCH_ID/confirm")
echo "$IMPORT_RESPONSE" | json_pp
echo ""
echo ""

echo "=== 步骤 5: 查看所有用户（发现问题: 新员工被错误授予管理员权限） ==="
echo "当前用户列表:"
curl -s "$BASE_URL/api/report/users" | json_pp
echo ""
echo ""

echo "=== 步骤 6: 查看批次报告（详细分析） ==="
echo "批次报告:"
curl -s "$BASE_URL/api/report/batches/$BATCH_ID/report" | json_pp
echo ""
echo ""

echo "=== 步骤 7: 检查可撤销状态（确认不会误删老用户） ==="
echo "可撤销检查:"
curl -s "$BASE_URL/api/revoke/batches/$BATCH_ID/can-revoke" | json_pp
echo ""
echo ""

echo "=== 步骤 8: 撤销整批 ==="
echo "撤销结果:"
REVOKE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/revoke/batches/$BATCH_ID/revoke")
echo "$REVOKE_RESPONSE" | json_pp
echo ""
echo ""

echo "=== 步骤 9: 验证撤销结果 ==="
echo "--- 再次查看用户列表（老用户王刚应该还存在，新员工赵晓、钱多多应该被删除） ---"
curl -s "$BASE_URL/api/report/users" | json_pp
echo ""
echo "--- 检查老用户王刚的详情（确认角色已恢复） ---"
curl -s "$BASE_URL/api/report/users/wanggang@company.com" | json_pp
echo ""
echo ""

echo "=== 步骤 10: 测试幂等性 - 再次撤销同一批次 ==="
echo "幂等撤销（应该返回已撤销）:"
curl -s -X POST "$BASE_URL/api/revoke/batches/$BATCH_ID/revoke" | json_pp
echo ""
echo ""

echo "=== 步骤 11: 获取重新导入上下文（复用上次的错误信息） ==="
echo "重新导入上下文:"
curl -s "$BASE_URL/api/report/batches/$BATCH_ID/reimport-context" | json_pp
echo ""
echo ""

echo "=== 步骤 12: 使用正确的角色映射重新导入 ==="
echo "创建正确的批次:"
CORRECT_BATCH_RESPONSE=$(curl -s -X POST "$BASE_URL/api/import/batches" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "2026年5月新员工导入 (修正后)",
    "creatorId": "admin-001",
    "users": [
      {
        "email": "zhaoxiao@company.com",
        "name": "赵晓",
        "departmentName": "技术部",
        "roleNames": ["实习生"]
      },
      {
        "email": "qianduoduo@company.com",
        "name": "钱多多",
        "departmentName": "运营部",
        "roleNames": ["运营人员"]
      },
      {
        "email": "sunli@company.com",
        "name": "孙丽",
        "departmentName": "市场部",
        "roleNames": ["市场人员"]
      }
    ]
  }')

CORRECT_BATCH_ID=$(echo "$CORRECT_BATCH_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['batch']['id'])")
echo "正确批次ID: $CORRECT_BATCH_ID"
echo ""

echo "预检正确批次:"
curl -s -X POST "$BASE_URL/api/import/batches/$CORRECT_BATCH_ID/precheck" | json_pp
echo ""

echo "确认导入正确批次:"
curl -s -X POST "$BASE_URL/api/import/batches/$CORRECT_BATCH_ID/confirm" | json_pp
echo ""
echo ""

echo "=== 步骤 13: 查看最终用户状态 ==="
echo "最终用户列表:"
curl -s "$BASE_URL/api/report/users" | json_pp
echo ""
echo ""

echo "========================================"
echo "  演示完成!"
echo "========================================"
echo ""
echo "关键点总结:"
echo "1. 批量导入时自动检测已存在用户"
echo "2. 撤销时只删除新创建的用户"
echo "3. 对已存在用户只恢复原角色"
echo "4. 撤销操作是幂等的"
echo "5. 报告详细显示每个用户的状态和可撤销性"
echo "6. 可获取重新导入上下文用于修正后再导入"
echo ""
