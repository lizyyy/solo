#!/bin/bash
# API 可观测标签校验系统演示脚本

BASE_URL="http://localhost:8080/api"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "=========================================="
echo "  API 可观测标签校验系统演示"
echo "=========================================="
echo ""

# 检查服务是否启动
echo -e "${YELLOW}检查服务是否启动...${NC}"
if ! curl -s --connect-timeout 2 "$BASE_URL/list" > /dev/null 2>&1; then
    echo -e "${RED}✗ 服务未启动或无法访问${NC}"
    echo ""
    echo "请先启动服务（按优先级选择）："
    echo "  📦 方式一: mvn spring-boot:run  (系统 Maven，最可靠)"
    echo "  🚀 方式二: ./quick-start.sh    (一键启动)"
    echo "  📥 方式三: ./mvnw spring-boot:run (使用 Maven Wrapper)"
    echo "  🎯 方式四: java -jar target/api-tag-validation-1.0.0.jar (预编译版本)"
    echo ""
    exit 1
fi
echo -e "${GREEN}✓ 服务已启动${NC}"
echo ""

# 1. 创建 API
echo "1. 创建 API"
echo "------------------------"
curl -X POST "$BASE_URL/create" \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "API-001",
    "apiName": "用户查询接口",
    "apiPath": "/api/v1/users",
    "apiMethod": "GET",
    "serviceName": "user-service",
    "description": "用户信息查询接口",
    "createdBy": "admin",
    "tagKeys": [
      {
        "keyName": "env",
        "description": "环境标识",
        "required": true,
        "allowedValues": ["prod", "test", "dev"]
      },
      {
        "keyName": "service",
        "description": "服务名称",
        "required": true
      },
      {
        "keyName": "version",
        "description": "版本号",
        "valuePattern": "^v\\d+\\.\\d+$"
      }
    ]
  }' | python3 -m json.tool
echo ""
echo ""

# 2. 提交合法样本
echo "2. 提交合法样本 - 应该通过校验"
echo "------------------------"
curl -X POST "$BASE_URL/report" \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "API-001",
    "sampleId": "SAMPLE-001",
    "source": "gateway",
    "tags": {
      "env": "prod",
      "service": "user-service",
      "version": "v1.0"
    }
  }' | python3 -m json.tool
echo ""
echo ""

# 3. 提交非法样本 - 包含未知标签和非法值
echo "3. 提交非法样本 - 包含未知标签 + 非法值"
echo "------------------------"
curl -X POST "$BASE_URL/report" \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "API-001",
    "sampleId": "SAMPLE-002",
    "source": "gateway",
    "tags": {
      "env": "production",
      "service": "user-service",
      "unknown_tag": "value123"
    }
  }' | python3 -m json.tool
echo ""
echo ""

# 4. 重复提交相同样本 - 验证幂等性
echo "4. 重复提交相同样本 - 验证幂等性（应返回相同结果，不重复创建）"
echo "------------------------"
curl -X POST "$BASE_URL/report" \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "API-001",
    "sampleId": "SAMPLE-002",
    "source": "gateway",
    "tags": {
      "env": "production",
      "service": "user-service",
      "unknown_tag": "value123"
    }
  }' | python3 -m json.tool
echo ""
echo ""

# 5. 提交格式不匹配样本
echo "5. 提交格式不匹配样本 - version 格式错误"
echo "------------------------"
curl -X POST "$BASE_URL/report" \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "API-001",
    "sampleId": "SAMPLE-003",
    "source": "gateway",
    "tags": {
      "env": "test",
      "service": "user-service",
      "version": "invalid_version"
    }
  }' | python3 -m json.tool
echo ""
echo ""

# 6. 查询 API 详情
echo "6. 查询 API 详情"
echo "------------------------"
curl -X GET "$BASE_URL/API-001" | python3 -m json.tool
echo ""
echo ""

# 7. 查询所有样本
echo "7. 查询所有样本"
echo "------------------------"
curl -X GET "$BASE_URL/API-001/samples" | python3 -m json.tool
echo ""
echo ""

# 8. 查询所有违规记录
echo "8. 查询所有违规记录"
echo "------------------------"
curl -X GET "$BASE_URL/API-001/violations" | python3 -m json.tool
echo ""
echo ""

# 9. 推进状态
echo "9. 推进 API 状态"
echo "------------------------"
curl -X POST "$BASE_URL/API-001/advance" | python3 -m json.tool
echo ""
echo ""

# 10. 再次推进状态
echo "10. 再次推进 API 状态"
echo "------------------------"
curl -X POST "$BASE_URL/API-001/advance" | python3 -m json.tool
echo ""
echo ""

# 11. 导出报告
echo "11. 导出 CSV 报告"
echo "------------------------"
curl -X GET "$BASE_URL/API-001/export" -o "validation_report.csv"
echo "报告已保存为 validation_report.csv"
echo ""

echo "=========================================="
echo "  演示完成！"
echo "=========================================="
