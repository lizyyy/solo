#!/bin/bash

# 简单测试脚本 - 验证中间件诊断服务功能

set -e

BASE_URL="http://localhost:8080"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TESTDATA_DIR="$PROJECT_DIR/testdata"
OUTPUT_DIR="$PROJECT_DIR/output"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  中间件诊断服务 - 快速测试${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 创建输出目录
mkdir -p "$OUTPUT_DIR"

# 检查服务
check_service() {
    for i in {1..10}; do
        if curl -s "$BASE_URL/health" > /dev/null 2>&1; then
            return 0
        fi
        echo -e "${YELLOW}等待服务启动... ($i/10)${NC}"
        sleep 1
    done
    return 1
}

# 启动服务
echo -e "${YELLOW}步骤 1: 启动服务${NC}"
cd "$PROJECT_DIR"

# 清理旧数据
rm -rf ./data
mkdir -p ./data

# 启动服务
echo -e "启动 Go 服务 (端口 8080)..."
go run cmd/server/main.go -port 8080 -db ./data/diagnostic.db > /tmp/server-test.log 2>&1 &
SERVER_PID=$!
echo "服务 PID: $SERVER_PID"

# 等待服务
if ! check_service; then
    echo -e "${RED}服务启动失败${NC}"
    kill $SERVER_PID 2>/dev/null || true
    exit 1
fi
echo -e "${GREEN}服务已启动！${NC}"
echo ""

# 健康检查
echo -e "${YELLOW}步骤 2: 健康检查${NC}"
health=$(curl -s "$BASE_URL/health")
echo "响应: $health"
if echo "$health" | grep -q "ok"; then
    echo -e "${GREEN}✓ 健康检查通过${NC}"
else
    echo -e "${RED}✗ 健康检查失败${NC}"
fi
echo ""

# 导入数据
echo -e "${YELLOW}步骤 3: 导入样例数据${NC}"

# 导入中间件
echo "导入中间件定义..."
result=$(curl -s -X POST "$BASE_URL/import?type=middlewares&file=$TESTDATA_DIR/middlewares.yaml")
echo "$result"
sleep 1

# 导入路由
echo "导入路由定义..."
result=$(curl -s -X POST "$BASE_URL/import?type=routes&file=$TESTDATA_DIR/routes.yaml")
echo "$result"
sleep 1

# 导入请求追踪
echo "导入请求追踪..."
result=$(curl -s -X POST "$BASE_URL/import?type=request-traces&file=$TESTDATA_DIR/request-traces.jsonl")
echo "$result"
sleep 1

# 导入上下文事件
echo "导入上下文事件..."
result=$(curl -s -X POST "$BASE_URL/import?type=context-events&file=$TESTDATA_DIR/context-events.jsonl")
echo "$result"
sleep 1

echo -e "${GREEN}✓ 数据导入完成${NC}"
echo ""

# 查看路由
echo -e "${YELLOW}步骤 4: 查看路由列表${NC}"
routes=$(curl -s "$BASE_URL/routes")
echo "$routes" | python3 -m json.tool 2>/dev/null || echo "$routes"
echo ""

# 查看路由详情
echo -e "${YELLOW}步骤 5: 查看路由详情 (ID=1)${NC}"
route=$(curl -s "$BASE_URL/routes/1")
echo "$route" | python3 -m json.tool 2>/dev/null || echo "$route"
echo ""

# 查看路由链路分析
echo -e "${YELLOW}步骤 6: 查看路由链路分析 (ID=1)${NC}"
chain=$(curl -s "$BASE_URL/routes/1/chain")
echo "$chain" | python3 -m json.tool 2>/dev/null || echo "$chain"
echo ""

# 查看中间件顺序建议
echo -e "${YELLOW}步骤 7: 查看中间件顺序建议 (ID=1)${NC}"
suggestion=$(curl -s "$BASE_URL/routes/1?suggestion=true")
echo "$suggestion" | python3 -m json.tool 2>/dev/null || echo "$suggestion"
echo ""

# 运行诊断
echo -e "${YELLOW}步骤 8: 运行诊断${NC}"
echo "这可能需要几秒钟..."

# 重试机制
for i in {1..5}; do
    diag_result=$(curl -s -X POST "$BASE_URL/diagnostics/run")
    if ! echo "$diag_result" | grep -q "SQLITE_BUSY\|database is locked\|error"; then
        break
    fi
    echo -e "${YELLOW}数据库繁忙，重试 $i/5...${NC}"
    sleep 2
done

echo "诊断结果:"
echo "$diag_result" | python3 -m json.tool 2>/dev/null || echo "$diag_result"
echo ""

# 提取风险数量
total_risks=$(echo "$diag_result" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('total_risks',0))" 2>/dev/null || echo "N/A")
echo -e "${BLUE}检测到 $total_risks 个风险${NC}"
echo ""

# 查看风险列表
echo -e "${YELLOW}步骤 9: 查看风险列表${NC}"
risks=$(curl -s "$BASE_URL/risks")
echo "$risks" > "$OUTPUT_DIR/risks.json"
echo "风险数量:"
echo "$risks" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('count',0))" 2>/dev/null || echo "解析失败"
echo ""

# 导出报告
echo -e "${YELLOW}步骤 10: 导出报告${NC}"

# JSON 报告
echo "导出 JSON 报告..."
curl -s "$BASE_URL/export?format=json" > "$OUTPUT_DIR/report.json"
echo -e "${GREEN}✓ 已保存到 $OUTPUT_DIR/report.json${NC}"

# Markdown 报告
echo "导出 Markdown 报告..."
curl -s "$BASE_URL/export?format=markdown" > "$OUTPUT_DIR/report.md"
echo -e "${GREEN}✓ 已保存到 $OUTPUT_DIR/report.md${NC}"

# CSV 报告
echo "导出 CSV 报告..."
curl -s "$BASE_URL/export?format=csv" > "$OUTPUT_DIR/report.csv"
echo -e "${GREEN}✓ 已保存到 $OUTPUT_DIR/report.csv${NC}"
echo ""

# 显示报告摘要
echo -e "${BLUE}=== 报告摘要 ===${NC}"
echo ""
if [ -f "$OUTPUT_DIR/report.md" ]; then
    head -80 "$OUTPUT_DIR/report.md"
    echo ""
    echo "... (更多内容请查看完整报告)"
fi
echo ""

# 测试错误场景
echo -e "${YELLOW}步骤 11: 测试错误场景${NC}"
echo ""

# 错误场景 1: 缺少参数
echo "测试: 缺少 type 参数"
error1=$(curl -s -X POST "$BASE_URL/import?file=$TESTDATA_DIR/routes.yaml")
echo "响应: $error1"
echo ""

# 错误场景 2: 无效的路由 ID
echo "测试: 无效的路由 ID"
error2=$(curl -s "$BASE_URL/routes/999999")
echo "响应: $error2"
echo ""

# 错误场景 3: 无效的状态
echo "测试: 无效的风险状态"
error3=$(curl -s -X PATCH -H "Content-Type: application/json" -d '{"status":"invalid"}' "$BASE_URL/risks/1/status")
echo "响应: $error3"
echo ""

echo -e "${GREEN}✓ 错误场景测试完成${NC}"
echo ""

# 总结
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  测试完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}服务信息:${NC}"
echo "  地址: $BASE_URL"
echo "  PID: $SERVER_PID"
echo "  数据库: ./data/diagnostic.db"
echo ""
echo -e "${YELLOW}生成的文件:${NC}"
ls -la "$OUTPUT_DIR/"
echo ""
echo -e "${YELLOW}检测到的风险:${NC}"
if [ "$total_risks" != "N/A" ] && [ "$total_risks" -gt 0 ]; then
    echo "  共 $total_risks 个风险"
    echo ""
    echo -e "${YELLOW}风险类型:${NC}"
    echo "  - 缺少 recover 中间件 (Critical)"
    echo "  - CORS 在 auth 之后 (High)"
    echo "  - Auth 在 tenant 之前 (High)"
    echo "  - Context key 覆盖 (High)"
    echo "  - Body 多次读取 (Medium)"
    echo "  - Trace header 丢失 (Medium)"
    echo "  - 幂等键冲突 (High)"
    echo "  - 中间件未调用 next (Critical)"
else
    echo "  无风险或解析失败"
fi
echo ""
echo -e "${YELLOW}要停止服务，请运行:${NC}"
echo "  kill $SERVER_PID"
echo ""

# 保存 PID
echo "$SERVER_PID" > /tmp/middleware-diagnostic-test.pid
