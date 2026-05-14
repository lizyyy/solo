#!/bin/bash
set -e

echo "========================================="
echo "  批量账号冻结后端服务 - 完整验证"
echo "========================================="
echo ""

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

# 检查编译
if [ ! -f "out/standalone/StandaloneServer.class" ]; then
    echo "📝 编译中..."
    javac -d out standalone/StandaloneServer.java
    echo "✅ 编译完成"
fi

# 启动服务（后台）
echo "🚀 启动服务..."
cd "$PROJECT_DIR/out"
java standalone.StandaloneServer > /tmp/server.log 2>&1 &
SERVER_PID=$!

sleep 2

if ! ps -p $SERVER_PID > /dev/null; then
    echo "❌ 服务启动失败"
    cat /tmp/server.log
    exit 1
fi
echo "✅ 服务已启动 (PID: $SERVER_PID)"
echo ""

# 测试 API
echo "🧪 开始 API 测试..."
echo ""

BASE_URL="http://localhost:8080/api"

test_api() {
    local name=$1
    local method=$2
    local url=$3
    local body=$4
    
    echo -n "   $name... "
    
    if [ "$method" = "GET" ]; then
        RESPONSE=$(curl -s "$url")
    else
        RESPONSE=$(curl -s -X "$method" -H "Content-Type: application/json" -d "$body" "$url")
    fi
    
    if echo "$RESPONSE" | grep -q '"code"\s*:\s*200'; then
        echo "✅"
        echo "      返回: $(echo "$RESPONSE" | tr -d '\n')"
        return 0
    else
        echo "❌"
        echo "      返回: $RESPONSE"
        return 1
    fi
}

test_api "根路径" "GET" "$BASE_URL" ""
echo ""
test_api "获取当前规则版本" "GET" "$BASE_URL/rule/current/version" ""
echo ""
test_api "获取规则列表" "GET" "$BASE_URL/rule/list" ""
echo ""
test_api "创建新规则" "POST" "$BASE_URL/rule/create" '{"name":"风控V2","operator":"admin"}'
echo ""
test_api "创建短信批次" "POST" "$BASE_URL/batch/sms/create" '{"name":"测试批次","operator":"admin"}'
echo ""
test_api "创建候选清单" "POST" "$BASE_URL/candidate/create" '{"name":"清理清单","operator":"admin"}'
echo ""
test_api "获取候选清单列表" "GET" "$BASE_URL/candidate/list" ""
echo ""

# 获取实际的批次号进行后续测试
BATCH_NO=$(curl -s -X POST "$BASE_URL/batch/sms/create" -H "Content-Type: application/json" -d '{}' | grep -o '"data":"[^"]*"' | cut -d'"' -f4)
if [ -n "$BATCH_NO" ]; then
    test_api "批次预览" "GET" "$BASE_URL/batch/$BATCH_NO/preview" ""
    echo ""
    test_api "获取批次详情" "GET" "$BASE_URL/batch/$BATCH_NO" ""
    echo ""
fi

echo ""
echo "========================================="
echo "  ✅ 所有核心 API 验证通过！"
echo "========================================="
echo ""
echo "服务仍在运行，可手动测试："
echo "  curl '$BASE_URL/rule/list'"
echo "  curl -X POST '$BASE_URL/batch/sms/create' -H 'Content-Type: application/json' -d '{\"name\":\"test\"}'"
echo ""
echo "停止服务： kill $SERVER_PID"
echo ""

# 保持服务运行供用户测试
echo "按 Enter 停止服务..."
read

kill $SERVER_PID 2>/dev/null || true
echo "✅ 服务已停止"
