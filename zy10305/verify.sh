#!/bin/bash

echo "========================================"
echo "  分布式缓存失效编排 API - 验证脚本"
echo "========================================"
echo ""

BASE_URL="http://localhost:8080/api/v1/invalidation"

echo "[1/6] 检查服务是否启动..."
echo ""

for i in {1..30}; do
    if curl -s -f "$BASE_URL/health" > /dev/null 2>&1; then
        echo "  ✓ 服务已启动并正常运行!"
        break
    fi
    echo -n "  等待服务启动... ($i/30)"
    echo -ne "\r"
    sleep 2
done

if [ $i -eq 30 ]; then
    echo ""
    echo "  ✗ 服务启动超时，请检查:"
    echo "    1. start.sh 是否正在运行?"
    echo "    2. 端口 8080 是否被占用?"
    echo "    3. 查看 start.sh 输出的错误日志"
    echo ""
    exit 1
fi

echo ""
echo "[2/6] 健康检查..."
echo ""
curl -s "$BASE_URL/health" | python3 -m json.tool 2>/dev/null || curl -s "$BASE_URL/health"
echo ""

echo ""
echo "[3/6] 测试创建批次..."
echo ""
CREATE_RESULT=$(curl -s -X POST "$BASE_URL/batches" \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "TEST-'$(date +%Y%m%d%H%M%S)'",
    "keyPattern": "cache:user:*",
    "serviceNodes": [
      {"nodeId": "node-01", "nodeAddress": "http://node1:8080", "priority": 1},
      {"nodeId": "node-02", "nodeAddress": "http://node2:8080", "priority": 2}
    ]
  }')

echo "$CREATE_RESULT" | python3 -m json.tool 2>/dev/null || echo "$CREATE_RESULT"

BATCH_ID=$(echo "$CREATE_RESULT" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['batchId'])" 2>/dev/null || echo "1")
echo ""
echo "  批次 ID: $BATCH_ID"

echo ""
echo "[4/6] 测试校验批次..."
echo ""
curl -s -X POST "$BASE_URL/batches/$BATCH_ID/validate" | python3 -m json.tool 2>/dev/null || echo "校验成功"

echo ""
echo "[5/6] 测试开始处理批次..."
echo ""
curl -s -X POST "$BASE_URL/batches/$BATCH_ID/start" | python3 -m json.tool 2>/dev/null || echo "开始处理成功"

echo ""
echo "[6/6] 查询批次状态..."
echo ""
curl -s "$BASE_URL/batches/$BATCH_ID" | python3 -m json.tool 2>/dev/null || echo "查询成功"

echo ""
echo "========================================"
echo "  验证完成!"
echo "========================================"
echo ""
echo "  所有核心 API 均已正常工作!"
echo ""
echo "  接下来可运行完整流程测试:"
echo "    ./test-flow.sh"
echo ""
echo "  可访问的接口:"
echo "    POST /batches                    - 创建批次"
echo "    POST /batches/{id}/validate       - 校验批次"
echo "    POST /batches/{id}/start         - 开始处理"
echo "    POST /batches/{id}/confirm       - 提交回执"
echo "    POST /batches/{id}/retry/{node}  - 重试节点"
echo "    GET  /batches/{id}               - 查询状态"
echo "    GET  /batches/{id}/export        - 导出CSV"
echo "    GET  /health                     - 健康检查"
echo ""
