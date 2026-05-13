#!/bin/bash

BASE_URL="http://localhost:3000/api"

echo "=== 临时权限到期 API - CURL 测试示例脚本"
echo ""
echo "基础URL: $BASE_URL"
echo ""

echo ""
echo "=== 1. 健康检查"
echo ""
curl -s http://localhost:3000/health | python3 -m json.tool

echo ""
echo ""
echo "=== 2. 获取权限类型"
echo ""
curl -s "$BASE_URL/types" | python3 -m json.tool

echo ""
echo ""
echo "=== 场景1: 数据库只读权限 - 正常授权流程"
echo ""

echo "步骤1: 申请数据库只读权限（有效期7天）"
PERMISSION_DB=$(curl -s -X POST "$BASE_URL/permissions" \
  -H "Content-Type: application/json" \
  -d '{
    "applicant": "zhangsan@company.com",
    "permissionType": "DB_READ_ONLY",
    "reason": "生产数据库问题排查 - 查询订单表数据异常",
    "requestedDays": 7
  }')

echo "$PERMISSION_DB" | python3 -m json.tool

PERMISSION_DB_ID=$(echo "$PERMISSION_DB" | python3 -c "import sys, json; data = json.load(sys.stdin); print(data['data']['id'])")

echo ""
echo "步骤2: 审批通过"
curl -s -X POST "$BASE_URL/permissions/$PERMISSION_DB_ID/approve" \
  -H "Content-Type: application/json" \
  -d '{
    "approver": "manager@company.com",
    "comment": "同意，排障需要"
  }' | python3 -m json.tool

echo ""
echo "步骤3: 授权"
curl -s -X POST "$BASE_URL/permissions/$PERMISSION_DB_ID/authorize" \
  -H "Content-Type: application/json" \
  -d '{
    "authorizer": "admin@company.com"
  }' | python3 -m json.tool

echo ""
echo "步骤4: 检查访问权限"
curl -s "$BASE_URL/permissions/$PERMISSION_DB_ID/check-access" | python3 -m json.tool

echo ""
echo ""
echo "=== 场景2: 日志查询权限 - 到期回收流程"
echo ""

echo "步骤1: 申请日志查询权限（有效期1天，方便测试到期）"
PERMISSION_LOG=$(curl -s -X POST "$BASE_URL/permissions" \
  -H "Content-Type: application/json" \
  -d '{
    "applicant": "lisi@company.com",
    "permissionType": "LOG_QUERY",
    "reason": "排查登录异常分析",
    "requestedDays": 1
  }')

echo "$PERMISSION_LOG" | python3 -m json.tool

PERMISSION_LOG_ID=$(echo "$PERMISSION_LOG" | python3 -c "import sys, json; data = json.load(sys.stdin); print(data['data']['id'])")

echo ""
echo "步骤2: 审批和授权"
curl -s -X POST "$BASE_URL/permissions/$PERMISSION_LOG_ID/approve" \
  -H "Content-Type: application/json" \
  -d '{
    "approver": "manager@company.com"
  }' > /dev/null

curl -s -X POST "$BASE_URL/permissions/$PERMISSION_LOG_ID/authorize" \
  -H "Content-Type: application/json" \
  -d '{
    "authorizer": "admin@company.com"
  }' > /dev/null

echo "权限已创建并授权完成"

echo ""
echo ""
echo "场景3: 发布操作权限 - 延期申请与审批"
echo ""

echo "步骤1: 申请发布操作权限（有效期2天）"
PERMISSION_DEPLOY=$(curl -s -X POST "$BASE_URL/permissions" \
  -H "Content-Type: application/json" \
  -d '{
    "applicant": "wangwu@company.com",
    "permissionType": "DEPLOY_OPERATION",
    "reason": "紧急修复部署",
    "requestedDays": 2
  }')

echo "$PERMISSION_DEPLOY" | python3 -m json.tool

PERMISSION_DEPLOY_ID=$(echo "$PERMISSION_DEPLOY" | python3 -c "import sys, json; data = json.load(sys.stdin); print(data['data']['id'])")

echo ""
echo "步骤2: 审批和授权"
curl -s -X POST "$BASE_URL/permissions/$PERMISSION_DEPLOY_ID/approve" \
  -H "Content-Type: application/json" \
  -d '{
    "approver": "manager@company.com"
  }' > /dev/null

curl -s -X POST "$BASE_URL/permissions/$PERMISSION_DEPLOY_ID/authorize" \
  -H "Content-Type: application/json" \
  -d '{
    "authorizer": "admin@company.com"
  }' > /dev/null

echo ""
echo "步骤3: 申请延期1天"
EXTENSION=$(curl -s -X POST "$BASE_URL/extensions" \
  -H "Content-Type: application/json" \
  -d "{
    \"permissionId\": \"$PERMISSION_DEPLOY_ID\",
    \"applicant\": \"wangwu@company.com\",
    \"additionalDays\": 1,
    \"reason\": \"修复尚未完成，需要继续调试\"
  }")

echo "$EXTENSION" | python3 -m json.tool

EXTENSION_ID=$(echo "$EXTENSION" | python3 -c "import sys, json; data = json.load(sys.stdin); print(data['data']['id'])")

echo ""
echo "步骤4: 延期审批通过"
curl -s -X POST "$BASE_URL/extensions/$EXTENSION_ID/approve" \
  -H "Content-Type: application/json" \
  -d '{
    "approver": "manager@company.com",
    "comment": "同意延期"
  }' | python3 -m json.tool

echo ""
echo "步骤5: 查看延期后的权限信息"
curl -s "$BASE_URL/permissions/$PERMISSION_DEPLOY_ID" | python3 -m json.tool

echo ""
echo ""
echo "=== 查询接口示例"
echo ""

echo "1. 当前有效权限"
curl -s "$BASE_URL/query/active" | python3 -m json.tool

echo ""
echo "2. 即将到期列表（3天内）"
curl -s "$BASE_URL/query/expiring?days=3" | python3 -m json.tool

echo ""
echo "3. 扫描汇总"
curl -s "$BASE_URL/scan/summary" | python3 -m json.tool

echo ""
echo "4. 审计报告"
curl -s "$BASE_URL/query/audit?limit=10" | python3 -m json.tool

echo ""
echo ""
echo "=== 场景4: 测试过期权限扫描与回收"
echo ""

echo "注意：为了测试到期回收，需要使用 generate_sample_data.js 生成已过期的测试数据"
echo "或者直接设置数据库中的 valid_to 字段为过去时间"

echo ""
echo "执行扫描:"
curl -s -X POST "$BASE_URL/scan/expired" | python3 -m json.tool

echo ""
echo "查看回收记录:"
curl -s "$BASE_URL/query/revoke-records" | python3 -m json.tool

echo ""
echo "查看待办回收任务:"
curl -s "$BASE_URL/tasks/revokes" | python3 -m json.tool

echo ""
echo ""
echo "=== 权限ID 保存"
echo "数据库只读权限ID: $PERMISSION_DB_ID"
echo "日志查询权限ID: $PERMISSION_LOG_ID"
echo "发布操作权限ID: $PERMISSION_DEPLOY_ID"

echo ""
echo ""
echo "测试完成！"
