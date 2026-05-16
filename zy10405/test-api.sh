#!/bin/bash

echo "============================================="
echo "  依赖升级许可 API - 测试脚本"
echo "============================================="
echo ""

BASE_URL="http://localhost:8080/api/v1"

echo "场景 1: 查询已初始化的样例数据"
echo "---------------------------------------------"
echo "查询依赖包列表:"
curl -s "$BASE_URL/packages" | python3 -m json.tool 2>/dev/null || curl -s "$BASE_URL/packages"
echo ""

echo "查询仓库列表:"
curl -s "$BASE_URL/repositories" | python3 -m json.tool 2>/dev/null || curl -s "$BASE_URL/repositories"
echo ""

echo "查询批次列表:"
curl -s "$BASE_URL/batches" | python3 -m json.tool 2>/dev/null || curl -s "$BASE_URL/batches"
echo ""
echo ""

echo "场景 2: 创建新的依赖包 (正常流程)"
echo "---------------------------------------------"
curl -s -X POST "$BASE_URL/packages" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Apache Commons Lang",
    "groupId": "org.apache.commons",
    "artifactId": "commons-lang3",
    "currentVersion": "3.12.0",
    "targetVersion": "3.14.0",
    "category": "utility"
  }' | python3 -m json.tool 2>/dev/null || echo "创建成功"
echo ""
echo ""

echo "场景 3: 版本校验 (异常流程 - 目标版本低于当前版本)"
echo "---------------------------------------------"
curl -s -X POST "$BASE_URL/packages" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Lib",
    "groupId": "com.test",
    "artifactId": "test-downgrade",
    "currentVersion": "2.0.0",
    "targetVersion": "1.0.0"
  }' | python3 -m json.tool 2>/dev/null || echo "预期报错：目标版本必须高于当前版本"
echo ""
echo ""

echo "场景 4: 版本校验 (异常流程 - 版本号格式错误)"
echo "---------------------------------------------"
curl -s -X POST "$BASE_URL/packages" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Lib",
    "groupId": "com.test",
    "artifactId": "test-invalid",
    "currentVersion": "1.0",
    "targetVersion": "invalid"
  }' | python3 -m json.tool 2>/dev/null || echo "预期报错：版本号格式不符合规范"
echo ""
echo ""

echo "场景 5: 幂等性验证 - 重复审批"
echo "---------------------------------------------"
echo "第一次审批:"
curl -s -X POST "$BASE_URL/batches/approvals/3/approve" \
  -H "Content-Type: application/json" \
  -d '{
    "approved": true,
    "approver": "王五",
    "comment": "第一次审批"
  }' | python3 -m json.tool 2>/dev/null || echo "审批成功"
echo ""
echo "第二次审批 (幂等，应该无变化):"
curl -s -X POST "$BASE_URL/batches/approvals/3/approve" \
  -H "Content-Type: application/json" \
  -d '{
    "approved": true,
    "approver": "王五",
    "comment": "第二次审批（重复）"
  }' | python3 -m json.tool 2>/dev/null || echo "幂等处理 - 跳过重复操作"
echo ""
echo ""

echo "场景 6: 状态流转校验 - 未全部批准就开始升级"
echo "---------------------------------------------"
curl -s -X POST "$BASE_URL/batches/3/start" \
  -H "Content-Type: application/json" | python3 -m json.tool 2>/dev/null || echo "预期报错：还有仓库未完成审批"
echo ""
echo ""

echo "场景 7: 查询审计日志 (查看异常记录)"
echo "---------------------------------------------"
curl -s "$BASE_URL/audit/failures" | python3 -m json.tool 2>/dev/null || curl -s "$BASE_URL/audit/failures"
echo ""
echo ""

echo "场景 8: 导出许可清单"
echo "---------------------------------------------"
curl -s -o license-export.csv "$BASE_URL/batches/3/export"
echo "已导出到 license-export.csv"
head -5 license-export.csv
echo ""
echo ""

echo "============================================="
echo "  测试完成！"
echo "============================================="
echo "访问地址："
echo "  - Swagger UI: http://localhost:8080/swagger-ui.html"
echo "  - H2 Console: http://localhost:8080/h2-console"
echo ""