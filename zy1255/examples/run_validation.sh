#!/bin/bash

BASE_URL="http://localhost:5001/api"
EXAMPLES_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== SQL Validator API 测试脚本 ==="
echo "示例目录: $EXAMPLES_DIR"
echo ""

echo "=== 1. 检查服务状态 ==="
curl -s "$BASE_URL/health" | python3 -m json.tool
echo ""

echo "=== 2. 查看统计信息 ==="
curl -s "$BASE_URL/statistics" | python3 -m json.tool
echo ""

echo "=== 3. 查看 curl 示例 ==="
curl -s "$BASE_URL/curl-examples" | python3 -m json.tool
echo ""

echo "=== 4. 查看坏样例示例 ==="
curl -s "$BASE_URL/bad-cases/examples" | python3 -m json.tool
echo ""

echo ""
echo "=== 5. 运行完整验证（需要先启动服务） ==="
echo ""
echo "提示: 先启动服务:"
echo "  python3 wsgi.py"
echo ""
echo "然后运行:"
echo "  curl -X POST $BASE_URL/validate \\"
echo "    -F \"name=测试验证\" \\"
echo "    -F \"schema=@$EXAMPLES_DIR/schema.sql\" \\"
echo "    -F \"cases=@$EXAMPLES_DIR/cases.yaml\""
echo ""
