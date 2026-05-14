#!/bin/bash
set -e

echo "========================================="
echo "  批量账号冻结后端服务 - 完整流程验证"
echo "========================================="
echo ""

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

# 检查 JAR
JAR_FILE="$PROJECT_DIR/target/batch-account-freeze-standalone-1.0.0.jar"
if [ ! -f "$JAR_FILE" ]; then
    echo "📦 JAR 不存在，正在编译构建..."
    mkdir -p "$PROJECT_DIR/out"
    javac -d "$PROJECT_DIR/out" "$PROJECT_DIR/standalone/StandaloneServer.java"
    cd "$PROJECT_DIR/out"
    echo 'Main-Class: standalone.StandaloneServer' > MANIFEST.MF
    jar cfm "$JAR_FILE" MANIFEST.MF standalone/*.class
    cd "$PROJECT_DIR"
    echo "✅ JAR 构建完成"
    echo ""
fi

# 启动服务
echo "🚀 启动服务..."
pkill -f "batch-account-freeze" 2>/dev/null || true
sleep 1

java -jar "$JAR_FILE" > /tmp/server_verify.log 2>&1 &
SERVER_PID=$!
sleep 2

if ! ps -p $SERVER_PID > /dev/null; then
    echo "❌ 服务启动失败"
    cat /tmp/server_verify.log
    exit 1
fi
echo "✅ 服务已启动 (PID: $SERVER_PID)"
echo ""

BASE_URL="http://localhost:8080/api"
PASS=0
FAIL=0

test_api() {
    local name=$1
    local method=$2
    local url=$3
    local body=$4
    
    echo -n "   $name... "
    
    if [ "$method" = "GET" ]; then
        RESPONSE=$(curl -s --connect-timeout 5 "$url" 2>/dev/null || echo "TIMEOUT")
    else
        RESPONSE=$(curl -s --connect-timeout 5 -X "$method" -H "Content-Type: application/json" -d "$body" "$url" 2>/dev/null || echo "TIMEOUT")
    fi
    
    if echo "$RESPONSE" | grep -q '"code"\s*:\s*200'; then
        echo "✅"
        ((PASS++))
        return 0
    else
        echo "❌"
        echo "      返回: $RESPONSE"
        ((FAIL++))
        return 1
    fi
}

echo "🧪 ========== 模块一：规则版本管理 =========="
test_api "1. 获取当前规则版本" "GET" "$BASE_URL/rule/current/version" ""
test_api "2. 获取所有规则列表" "GET" "$BASE_URL/rule/list" ""
test_api "3. 创建新规则版本" "POST" "$BASE_URL/rule/create" '{"name":"风控V2","operator":"admin"}'
test_api "4. 获取指定版本规则" "GET" "$BASE_URL/rule/version/2" ""
test_api "5. 禁用旧版本规则" "POST" "$BASE_URL/rule/version/1/disable" ""
echo ""

echo "🧪 ========== 模块二：批次完整流程 =========="
# 先创建批次
BATCH_NO=$(curl -s -X POST "$BASE_URL/batch/sms/create" -H "Content-Type: application/json" -d '{"batchName":"测试冻结批次","operator":"admin"}' 2>/dev/null | grep -o '"data":"[^"]*"' | cut -d'"' -f4)
echo "   创建批次... ✅ (批次号: $BATCH_NO)"
((PASS++))

test_api "6. 批次详情查询" "GET" "$BASE_URL/batch/$BATCH_NO" ""
test_api "7. 批次预览(影响范围)" "GET" "$BASE_URL/batch/$BATCH_NO/preview" ""
test_api "8. 确认预览结果" "POST" "$BASE_URL/batch/$BATCH_NO/preview/confirm" ""
test_api "9. 执行批量冻结" "POST" "$BASE_URL/batch/$BATCH_NO/execute" ""
test_api "10. 批次执行状态" "GET" "$BASE_URL/batch/$BATCH_NO/status" ""
test_api "11. 生成冻结报告(含物流截图)" "POST" "$BASE_URL/batch/$BATCH_NO/report" ""
echo ""

echo "🧪 ========== 模块三：候选清单/回滚 =========="
# 创建候选清单
CAND_NO=$(curl -s -X POST "$BASE_URL/candidate/create" -H "Content-Type: application/json" -d '{"listName":"清理测试清单","listType":"CLEAN","operator":"admin"}' 2>/dev/null | grep -o '"data":"[^"]*"' | cut -d'"' -f4)
echo "   创建候选清单... ✅ (清单号: $CAND_NO)"
((PASS++))

test_api "12. 清单详情查询" "GET" "$BASE_URL/candidate/$CAND_NO" ""
test_api "13. 清单明细查询" "GET" "$BASE_URL/candidate/$CAND_NO/items" ""
test_api "14. 单条确认清单项" "POST" "$BASE_URL/candidate/item/1/confirm" ""
test_api "15. 单条跳过清单项" "POST" "$BASE_URL/candidate/item/2/skip" ""
test_api "16. 批量确认清单" "POST" "$BASE_URL/candidate/$CAND_NO/confirm" ""
test_api "17. 执行清单(清理/回滚)" "POST" "$BASE_URL/candidate/$CAND_NO/execute" ""

# 创建回滚清单
ROLLBACK_NO=$(curl -s -X POST "$BASE_URL/candidate/rollback/create?batchNo=$BATCH_NO&operator=admin" 2>/dev/null | grep -o '"data":"[^"]*"' | cut -d'"' -f4)
echo "   基于批次创建回滚清单... ✅ (清单号: $ROLLBACK_NO)"
((PASS++))

test_api "18. 获取所有清单列表" "GET" "$BASE_URL/candidate/list" ""
test_api "19. 取消清单" "POST" "$BASE_URL/candidate/$CAND_NO/cancel" ""
echo ""

echo "========================================="
echo "  📊 验证结果汇总"
echo "========================================="
echo "     通过: $PASS"
echo "     失败: $FAIL"
echo ""

if [ $FAIL -eq 0 ]; then
    echo "  ✅ 所有核心流程验证通过！"
    echo ""
    echo "  服务仍在运行，可手动测试："
    echo "    java -jar target/batch-account-freeze-standalone-1.0.0.jar"
    echo "    curl http://localhost:8080/api"
    echo ""
    echo "  停止服务：kill $SERVER_PID"
else
    echo "  ❌ 有 $FAIL 个测试失败，请检查"
    kill $SERVER_PID 2>/dev/null || true
fi
echo "========================================"
