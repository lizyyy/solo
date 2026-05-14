#!/bin/bash

BASE_URL="http://localhost:8080/api/v1/compensation"

echo "======================================"
echo "跨服务补偿指令 API 测试脚本"
echo "======================================"

echo -e "\n1. 创建补偿流程..."
curl -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d @src/test/resources/test-request.json

echo -e "\n\n2. 再次提交相同请求（幂等测试）..."
curl -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d @src/test/resources/test-request.json

echo -e "\n\n3. 查看流程详情..."
curl -X GET "$BASE_URL/ORDER-20240514-001"

echo -e "\n\n4. 启动补偿流程..."
curl -X POST "$BASE_URL/ORDER-20240514-001/start"

echo -e "\n\n5. 获取待执行指令..."
curl -X GET "$BASE_URL/ORDER-20240514-001/next"

echo -e "\n\n6. 人工确认指令 INST-ORDER-20240514-001-2..."
curl -X POST "$BASE_URL/instruction/INST-ORDER-20240514-001-2/confirm" \
  -H "Content-Type: application/json" \
  -d '{"operator":"admin","remark":"确认可以通知"}'

echo -e "\n\n7. 执行指令 INST-ORDER-20240514-001-1..."
curl -X POST "$BASE_URL/instruction/INST-ORDER-20240514-001-1/execute" \
  -H "Content-Type: application/json" \
  -d '{"executionId":"EXEC-001","executor":"system","resultDetail":"库存已回滚"}'

echo -e "\n\n8. 重复执行（幂等测试）..."
curl -X POST "$BASE_URL/instruction/INST-ORDER-20240514-001-1/execute" \
  -H "Content-Type: application/json" \
  -d '{"executionId":"EXEC-001","executor":"system","resultDetail":"库存已回滚"}'

echo -e "\n\n9. 查看历史记录..."
curl -X GET "$BASE_URL/history?status=COMPENSATING"

echo -e "\n\n10. 导出执行报告..."
curl -X GET "$BASE_URL/ORDER-20240514-001/export"

echo -e "\n\n测试完成！"
