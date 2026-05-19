#!/bin/bash

BASE_URL="http://localhost:8000"

echo "=== 公益书库管理系统 curl 示例 ==="
echo ""

echo "1. 健康检查"
echo "curl $BASE_URL/health"
curl -s "$BASE_URL/health" | python3 -m json.tool 2>/dev/null || curl -s "$BASE_URL/health"
echo ""
echo ""

echo "2. 导入单本书籍"
echo 'curl -X POST "'$BASE_URL'/api/books/import" -H "Content-Type: application/json" -d "[{\"isbn\":\"9787107186142\",\"title\":\"测试书籍\",\"grade\":\"一年级\",\"condition\":\"全新\",\"donor_name\":\"测试用户\",\"quantity\":1}]"'
echo ""
echo ""

echo "3. 查询所有书籍"
echo "curl $BASE_URL/api/books"
echo ""
echo ""

echo "4. 按年级查询"
echo "curl '$BASE_URL/api/books?grade=G1'"
echo ""
echo ""

echo "5. 生成分级上架清单"
echo "curl -X POST $BASE_URL/api/shelf-list/generate"
echo ""
echo ""

echo "6. 查询导入批次历史"
echo "curl $BASE_URL/api/history/batches"
echo ""
echo ""

echo "7. 查询操作日志"
echo "curl $BASE_URL/api/history/operations"
echo ""
echo ""

echo "8. 获取统计数据"
echo "curl $BASE_URL/api/stats"
echo ""
echo ""

echo "=== 快速测试命令 (按顺序执行) ==="
cat << 'EOF'
# 1. 启动服务
python main.py

# 2. 新开终端，运行测试脚本
python test_flow.py

# 3. 或使用单独curl命令
curl -X POST "http://localhost:8000/api/books/import" \
  -H "Content-Type: application/json" \
  -d '[
    {"isbn":"9787107186142","title":"语文一年级","grade":"一年级","condition":"全新","donor_name":"张三","donor_phone":"13800138000"},
    {"isbn":"9787107186159","title":"数学二年级","grade":"二年级","condition":"九成新","donor_name":"李四"},
    {"isbn":"9787107186166","title":"英语七年级","grade":"初一","condition":"八成新","donor_name":"王五"}
  ]' | python3 -m json.tool

curl "http://localhost:8000/api/books" | python3 -m json.tool

curl -X POST "http://localhost:8000/api/shelf-list/generate" | python3 -m json.tool

curl "http://localhost:8000/api/stats" | python3 -m json.tool
EOF
