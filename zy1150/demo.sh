#!/bin/bash

# Go HTTP 中间件链路诊断服务演示脚本

set -e

BASE_URL="http://localhost:8080"
PROJECT_DIR="/Users/lzy/pro/solocoder/pro/zy1150/repo/zy1150"
TESTDATA_DIR="$PROJECT_DIR/testdata"
OUTPUT_DIR="$PROJECT_DIR/output"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Go HTTP 中间件链路诊断服务演示${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 创建输出目录
mkdir -p "$OUTPUT_DIR"

# 函数：等待服务启动
wait_for_service() {
    echo -e "${YELLOW}等待服务启动...${NC}"
    for i in {1..30}; do
        if curl -s "$BASE_URL/health" > /dev/null 2>&1; then
            echo -e "${GREEN}服务已启动！${NC}"
            return 0
        fi
        sleep 1
    done
    echo -e "${RED}服务启动超时${NC}"
    return 1
}

# 函数：执行 API 调用
api_call() {
    local method=$1
    local endpoint=$2
    local description=$3
    local output_file=$4
    
    echo -e "${BLUE}▶ $description${NC}"
    echo -e "  URL: $BASE_URL$endpoint"
    
    if [ "$method" = "POST" ]; then
        result=$(curl -s -X POST "$BASE_URL$endpoint")
    else
        result=$(curl -s "$BASE_URL$endpoint")
    fi
    
    if [ -n "$output_file" ]; then
        echo "$result" | python3 -m json.tool > "$output_file" 2>/dev/null || echo "$result" > "$output_file"
        echo -e "  输出已保存到: $output_file"
    else
        echo "$result" | python3 -m json.tool 2>/dev/null || echo "$result"
    fi
    echo ""
}

echo -e "${YELLOW}步骤 1: 启动服务${NC}"
cd "$PROJECT_DIR"

# 清理旧数据
rm -rf ./data
mkdir -p ./data

# 在后台启动服务
echo -e "启动 Go 服务 (端口 8080)..."
go run cmd/server/main.go -port 8080 -db ./data/diagnostic.db > /tmp/server.log 2>&1 &
SERVER_PID=$!
echo "服务 PID: $SERVER_PID"

# 等待服务启动
wait_for_service
echo ""

# 健康检查
api_call "GET" "/health" "健康检查"

echo -e "${YELLOW}步骤 2: 导入样例数据${NC}"
echo ""

# 导入中间件
api_call "POST" "/import?type=middlewares&file=$TESTDATA_DIR/middlewares.yaml" "导入中间件定义" "$OUTPUT_DIR/import-middlewares.json"
sleep 1

# 导入路由
api_call "POST" "/import?type=routes&file=$TESTDATA_DIR/routes.yaml" "导入路由定义" "$OUTPUT_DIR/import-routes.json"
sleep 1

# 导入请求追踪
api_call "POST" "/import?type=request-traces&file=$TESTDATA_DIR/request-traces.jsonl" "导入请求追踪数据" "$OUTPUT_DIR/import-traces.json"
sleep 1

# 导入上下文事件
api_call "POST" "/import?type=context-events&file=$TESTDATA_DIR/context-events.jsonl" "导入上下文事件数据" "$OUTPUT_DIR/import-events.json"
sleep 1

# 导入策略
api_call "POST" "/import?type=policies&file=$TESTDATA_DIR/policies.yaml" "导入策略定义" "$OUTPUT_DIR/import-policies.json"
sleep 1

echo -e "${YELLOW}步骤 3: 查看导入的数据${NC}"
echo ""

# 查看路由列表
api_call "GET" "/routes" "查看所有路由" "$OUTPUT_DIR/routes.json"

echo -e "${YELLOW}步骤 4: 运行诊断检查${NC}"
echo ""

# 运行诊断
echo -e "${BLUE}▶ 运行所有诊断规则${NC}"
echo -e "  URL: $BASE_URL/diagnostics/run"
for i in {1..5}; do
    result=$(curl -s -X POST "$BASE_URL/diagnostics/run")
    if echo "$result" | grep -q "SQLITE_BUSY\|database is locked"; then
        echo -e "${YELLOW}  数据库繁忙，重试 $i/5...${NC}"
        sleep 2
    else
        break
    fi
done
echo "$result" | python3 -m json.tool > "$OUTPUT_DIR/diagnostic-result.json" 2>/dev/null || echo "$result" > "$OUTPUT_DIR/diagnostic-result.json"
echo -e "  输出已保存到: $OUTPUT_DIR/diagnostic-result.json"
echo ""

# 解析诊断结果统计
total_risks=$(echo "$result" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('total_risks',0))" 2>/dev/null || echo "N/A")
echo -e "${YELLOW}诊断结果摘要:${NC}"
echo -e "  总风险数: $total_risks"
echo ""

echo -e "${YELLOW}步骤 5: 查看检测到的风险${NC}"
echo ""

# 查看所有风险
api_call "GET" "/risks" "查看所有风险" "$OUTPUT_DIR/risks.json"

echo -e "${YELLOW}步骤 6: 查看路由的中间件链路${NC}"
echo ""

# 查看路由 1 的详细信息（假设 ID 为 1）
api_call "GET" "/routes/1" "查看路由 ID=1 的中间件链路" "$OUTPUT_DIR/route-1.json"
api_call "GET" "/routes/1/chain" "查看路由 ID=1 的链路分析" "$OUTPUT_DIR/route-1-chain.json"
api_call "GET" "/routes/1?suggestion=true" "查看路由 ID=1 的中间件顺序建议"

echo -e "${YELLOW}步骤 7: 查看请求追踪详情${NC}"
echo ""

# 查看 trace-001 的详情
api_call "GET" "/traces/trace-001" "查看请求追踪 trace-001" "$OUTPUT_DIR/trace-001.json"
api_call "GET" "/traces/trace-001?events=true" "查看请求追踪 trace-001 及上下文事件" "$OUTPUT_DIR/trace-001-events.json"

echo -e "${YELLOW}步骤 8: 导出诊断报告${NC}"
echo ""

# 导出 JSON 报告
echo -e "${BLUE}▶ 导出 JSON 报告${NC}"
curl -s "$BASE_URL/export?format=json" > "$OUTPUT_DIR/report.json"
echo -e "  报告已保存到: $OUTPUT_DIR/report.json"

# 导出 Markdown 报告
echo -e "${BLUE}▶ 导出 Markdown 报告${NC}"
curl -s "$BASE_URL/export?format=markdown" > "$OUTPUT_DIR/report.md"
echo -e "  报告已保存到: $OUTPUT_DIR/report.md"

# 导出 CSV 报告
echo -e "${BLUE}▶ 导出 CSV 报告${NC}"
curl -s "$BASE_URL/export?format=csv" > "$OUTPUT_DIR/report.csv"
echo -e "  报告已保存到: $OUTPUT_DIR/report.csv"
echo ""

echo -e "${YELLOW}步骤 9: 风险状态管理示例${NC}"
echo ""

# 获取第一个风险 ID 并更新状态
first_risk_id=$(grep -o '"id":[0-9]*' "$OUTPUT_DIR/risks.json" | head -1 | cut -d: -f2)
if [ -n "$first_risk_id" ] && [ "$first_risk_id" != "null" ]; then
    echo -e "${BLUE}▶ 将风险 ID=$first_risk_id 标记为已确认${NC}"
    curl -s -X PATCH -H "Content-Type: application/json" \
        -d '{"status":"confirmed"}' \
        "$BASE_URL/risks/$first_risk_id/status"
    echo ""
    echo ""
fi

echo -e "${YELLOW}步骤 10: 显示生成的报告摘要${NC}"
echo ""

echo -e "${BLUE}=== 生成的文件 ===${NC}"
ls -la "$OUTPUT_DIR/"
echo ""

echo -e "${BLUE}=== Markdown 报告摘要 ===${NC}"
head -100 "$OUTPUT_DIR/report.md"
echo ""
echo -e "... (完整报告请查看 $OUTPUT_DIR/report.md)"
echo ""

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  演示完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}服务信息:${NC}"
echo -e "  地址: http://localhost:8080"
echo -e "  数据库: ./data/diagnostic.db"
echo -e "  输出目录: $OUTPUT_DIR"
echo ""
echo -e "${YELLOW}可用的 API 端点:${NC}"
echo -e "  GET  /health                      - 健康检查"
echo -e "  POST /import?type=<type>&file=<path> - 导入数据"
echo -e "  GET  /routes                      - 列出所有路由"
echo -e "  GET  /routes/<id>                 - 获取路由详情"
echo -e "  POST /diagnostics/run             - 运行诊断"
echo -e "  GET  /risks                       - 列出风险"
echo -e "  GET  /export?format=<json|md|csv> - 导出报告"
echo ""
echo -e "${YELLOW}要停止服务，请运行:${NC}"
echo -e "  kill $SERVER_PID"
echo ""

# 保存服务 PID
echo "$SERVER_PID" > /tmp/middleware-diagnostic-server.pid
