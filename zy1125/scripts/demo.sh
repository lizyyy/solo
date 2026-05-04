#!/bin/bash

# 配置管理服务演示脚本
# 请确保服务已启动: go run cmd/server/main.go --seed

BASE_URL="http://localhost:8080"
OPERATOR="demo_user"

TENANT_ID="t_001"
SERVICE_ID="s_001"

# 使用种子数据中的配置项
CONFIG_RATE_LIMIT="c_001"
CONFIG_FEATURE="c_002"

# 草稿版本
VERSION_DRAFT_RATE="v_004"
VERSION_DRAFT_FEATURE="v_005"

echo "======================================"
echo "配置管理服务演示"
echo "======================================"
echo ""

# 1. 健康检查
echo "1. 健康检查"
curl -s "${BASE_URL}/health" | head -c 200
echo ""
echo ""

# 2. 校验配置值
echo "2. 校验限流配置 (合法值)"
curl -s -X POST "${BASE_URL}/api/v1/configs/${CONFIG_RATE_LIMIT}/validate" \
  -H "Content-Type: application/json" \
  -H "X-Operator: ${OPERATOR}" \
  -d '{"value": {"max_qps": 500, "window_sec": 60}}'
echo ""
echo ""

echo "3. 校验限流配置 (非法值 - 类型错误)"
curl -s -X POST "${BASE_URL}/api/v1/configs/${CONFIG_RATE_LIMIT}/validate" \
  -H "Content-Type: application/json" \
  -H "X-Operator: ${OPERATOR}" \
  -d '{"value": {"max_qps": "not_a_number", "window_sec": 60}}'
echo ""
echo ""

# 4. 查看版本差异 (需要先创建)
echo "4. 查看版本差异 v1 -> v2 (rate_limit)"
curl -s "${BASE_URL}/api/v1/versions/v_001/diff/v_004"
echo ""
echo ""

# 5. 创建发布批次
echo "5. 创建发布批次 (灰度 30%，仅限 zh_CN 地区)"
RELEASE_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/v1/releases" \
  -H "Content-Type: application/json" \
  -H "X-Operator: ${OPERATOR}" \
  -d "{
    \"tenant_id\": \"${TENANT_ID}\",
    \"service_id\": \"${SERVICE_ID}\",
    \"name\": \"限流升级 + 新功能开启\",
    \"config_changes\": [\"${VERSION_DRAFT_RATE}\", \"${VERSION_DRAFT_FEATURE}\"],
    \"gray_rule\": {
      \"percentage\": 30,
      \"regions\": [\"zh_CN\"]
    }
  }")

echo "${RELEASE_RESPONSE}"
RELEASE_ID=$(echo "${RELEASE_RESPONSE}" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo ""
echo "发布批次 ID: ${RELEASE_ID}"
echo ""

if [ -z "${RELEASE_ID}" ] || [ "${RELEASE_ID}" = "null" ]; then
  echo "警告: 未获取到有效的发布批次 ID，使用默认值继续演示"
  echo ""
fi

# 6. 启动发布
echo "6. 启动发布"
if [ -n "${RELEASE_ID}" ] && [ "${RELEASE_ID}" != "null" ]; then
  curl -s -X POST "${BASE_URL}/api/v1/releases/${RELEASE_ID}/start" \
    -H "X-Operator: ${OPERATOR}"
else
  echo "跳过: 无效的发布批次 ID"
fi
echo ""
echo ""

# 7. 模拟客户端拉取配置
echo "7. 模拟多个客户端拉取配置"
echo "  - 客户端 client_001 (zh_CN 地区) - 可能命中灰度"
curl -s -X GET "${BASE_URL}/api/v1/clients/${TENANT_ID}/${SERVICE_ID}/client_001/configs" \
  -H "X-Region: zh_CN" \
  -D /tmp/headers_001.txt
echo ""
echo "  响应头 ETag:"
grep -i etag /tmp/headers_001.txt || echo "  (无)"
echo ""

echo "  - 客户端 client_002 (zh_CN 地区) - 可能命中灰度"
curl -s -X GET "${BASE_URL}/api/v1/clients/${TENANT_ID}/${SERVICE_ID}/client_002/configs" \
  -H "X-Region: zh_CN"
echo ""
echo ""

echo "  - 客户端 client_003 (en_US 地区) - 不命中灰度"
curl -s -X GET "${BASE_URL}/api/v1/clients/${TENANT_ID}/${SERVICE_ID}/client_003/configs" \
  -H "X-Region: en_US"
echo ""
echo ""

# 8. 测试 ETag 缓存
echo "8. 测试 ETag 缓存 (客户端发送 If-None-Match)"
ETAG=$(grep -i etag /tmp/headers_001.txt | cut -d' ' -f2 | tr -d '\r')
if [ -n "${ETAG}" ]; then
  echo "  使用 ETag: ${ETAG}"
  curl -s -X GET "${BASE_URL}/api/v1/clients/${TENANT_ID}/${SERVICE_ID}/client_001/configs" \
    -H "X-Region: zh_CN" \
    -H "If-None-Match: ${ETAG}" \
    -D /tmp/headers_cached.txt
  echo "  响应状态码:"
  grep -i HTTP /tmp/headers_cached.txt || echo "  (无)"
else
  echo "  跳过: 没有获取到 ETag"
fi
echo ""
echo ""

# 9. 暂停发布
echo "9. 暂停发布"
if [ -n "${RELEASE_ID}" ] && [ "${RELEASE_ID}" != "null" ]; then
  curl -s -X POST "${BASE_URL}/api/v1/releases/${RELEASE_ID}/pause" \
    -H "X-Operator: ${OPERATOR}"
else
  echo "跳过: 无效的发布批次 ID"
fi
echo ""
echo ""

# 10. 生成发布报告
echo "10. 生成发布报告 (JSON 格式)"
if [ -n "${RELEASE_ID}" ] && [ "${RELEASE_ID}" != "null" ]; then
  curl -s "${BASE_URL}/api/v1/releases/${RELEASE_ID}/report?format=json" | head -c 1500
else
  echo "跳过: 无效的发布批次 ID"
fi
echo ""
echo ""

echo "11. 生成发布报告 (Markdown 格式)"
if [ -n "${RELEASE_ID}" ] && [ "${RELEASE_ID}" != "null" ]; then
  curl -s "${BASE_URL}/api/v1/releases/${RELEASE_ID}/report?format=markdown"
else
  echo "跳过: 无效的发布批次 ID"
fi
echo ""
echo ""

# 12. 回滚发布
echo "12. 回滚发布 (原因: 观察到错误率上升)"
if [ -n "${RELEASE_ID}" ] && [ "${RELEASE_ID}" != "null" ]; then
  curl -s -X POST "${BASE_URL}/api/v1/releases/${RELEASE_ID}/rollback" \
    -H "Content-Type: application/json" \
    -H "X-Operator: ${OPERATOR}" \
    -d '{"reason": "观察到错误率上升，需要回滚"}'
else
  echo "跳过: 无效的发布批次 ID"
fi
echo ""
echo ""

# 13. 回滚后再次查看报告
echo "13. 回滚后的发布报告"
if [ -n "${RELEASE_ID}" ] && [ "${RELEASE_ID}" != "null" ]; then
  curl -s "${BASE_URL}/api/v1/releases/${RELEASE_ID}/report?format=json"
else
  echo "跳过: 无效的发布批次 ID"
fi
echo ""
echo ""

# 14. 测试异常输入
echo "14. 测试异常输入 - 灰度比例超过 100"
curl -s -X POST "${BASE_URL}/api/v1/releases" \
  -H "Content-Type: application/json" \
  -H "X-Operator: ${OPERATOR}" \
  -d "{
    \"tenant_id\": \"${TENANT_ID}\",
    \"service_id\": \"${SERVICE_ID}\",
    \"name\": \"错误的灰度比例\",
    \"config_changes\": [\"${VERSION_DRAFT_RATE}\"],
    \"gray_rule\": {
      \"percentage\": 150
    }
  }"
echo ""
echo ""

echo "======================================"
echo "演示完成"
echo "======================================"
