#!/bin/bash

# Performance Tracker 完整演示脚本
# 这个脚本展示了从创建项目到导出报告的完整流程

set -e

BASE_URL="http://localhost:8080"
TESTDATA_DIR="./testdata"

echo "=========================================="
echo "Performance Tracker 演示脚本"
echo "=========================================="
echo ""

# 检查服务是否启动
echo "1. 检查服务是否启动..."
HEALTH_CHECK=$(curl -s "$BASE_URL/health" || echo "{}")
if [ -z "$HEALTH_CHECK" ] || [ "$HEALTH_CHECK" = "{}" ]; then
    echo "❌ 服务未启动，请先运行: go run cmd/api/main.go"
    exit 1
fi
echo "✅ 服务运行正常"
echo ""

# 创建项目
echo "2. 创建项目..."
PROJECT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/projects" \
    -H "Content-Type: application/json" \
    -d '{
        "name": "user-service-2024-q4-demo",
        "description": "用户服务 Q4 性能排查项目（演示）",
        "service_name": "user-service",
        "version": "v2.1.0-demo"
    }')

PROJECT_ID=$(echo "$PROJECT_RESPONSE" | grep -o '"id":[0-9]*' | grep -o '[0-9]*$')
echo "✅ 项目创建成功，ID: $PROJECT_ID"
echo ""

# 导入路由配置
echo "3. 导入路由配置..."
if [ -f "$TESTDATA_DIR/routes.yaml" ]; then
    IMPORT_ROUTES=$(curl -s -X POST "$BASE_URL/api/v1/import/routes" \
        -H "Content-Type: multipart/form-data" \
        -F "project_id=$PROJECT_ID" \
        -F "file=@$TESTDATA_DIR/routes.yaml")
    echo "✅ 路由配置导入成功"
else
    echo "⚠️  未找到 routes.yaml 文件，跳过路由导入"
fi
echo ""

# 导入请求样本
echo "4. 导入请求样本..."
if [ -f "$TESTDATA_DIR/samples.jsonl" ]; then
    IMPORT_SAMPLES=$(curl -s -X POST "$BASE_URL/api/v1/import/samples" \
        -H "Content-Type: multipart/form-data" \
        -F "project_id=$PROJECT_ID" \
        -F "file=@$TESTDATA_DIR/samples.jsonl")
    echo "✅ 请求样本导入成功"
else
    echo "⚠️  未找到 samples.jsonl 文件，跳过样本导入"
fi
echo ""

# 导入基线数据
echo "5. 导入基线数据..."
if [ -f "$TESTDATA_DIR/baseline.json" ]; then
    IMPORT_BASELINE=$(curl -s -X POST "$BASE_URL/api/v1/import/baseline" \
        -H "Content-Type: multipart/form-data" \
        -F "project_id=$PROJECT_ID" \
        -F "file=@$TESTDATA_DIR/baseline.json")
    echo "✅ 基线数据导入成功"
else
    echo "⚠️  未找到 baseline.json 文件，跳过基线导入"
fi
echo ""

# 创建运行任务
echo "6. 创建运行任务..."
RUN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/runs" \
    -H "Content-Type: application/json" \
    -d "{
        \"project_id\": $PROJECT_ID,
        \"name\": \"v2.1.0-demo-回放测试\",
        \"description\": \"演示版本性能回归测试\",
        \"concurrency\": 3,
        \"target_rps\": 10,
        \"timeout_ms\": 5000,
        \"total_requests\": 50
    }")

RUN_ID=$(echo "$RUN_RESPONSE" | grep -o '"id":[0-9]*' | grep -o '[0-9]*$')
echo "✅ 运行任务创建成功，ID: $RUN_ID"
echo ""

# 启动运行任务
echo "7. 启动运行任务（并发数: 3, 目标 RPS: 10, 总请求数: 50）..."
START_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/runs/$RUN_ID/start")
echo "✅ 运行任务已启动"
echo ""

# 轮询运行状态
echo "8. 等待运行任务完成..."
for i in {1..60}; do
    STATUS_RESPONSE=$(curl -s "$BASE_URL/api/v1/runs/$RUN_ID")
    STATUS=$(echo "$STATUS_RESPONSE" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
    COMPLETED=$(echo "$STATUS_RESPONSE" | grep -o '"completed_requests":[0-9]*' | grep -o '[0-9]*$')
    TOTAL=$(echo "$STATUS_RESPONSE" | grep -o '"total_requests":[0-9]*' | grep -o '[0-9]*$')
    
    if [ -z "$COMPLETED" ]; then
        COMPLETED=0
    fi
    
    echo "   状态: $STATUS ($COMPLETED/$TOTAL 请求)"
    
    if [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ] || [ "$STATUS" = "stopped" ]; then
        break
    fi
    sleep 2
done

if [ "$STATUS" = "completed" ]; then
    echo "✅ 运行任务完成"
else
    echo "⚠️  运行任务状态: $STATUS"
fi
echo ""

# 导入性能事件
echo "9. 导入性能事件数据..."
if [ -f "$TESTDATA_DIR/profile-events.json" ]; then
    IMPORT_EVENTS=$(curl -s -X POST "$BASE_URL/api/v1/import/profile-events" \
        -H "Content-Type: multipart/form-data" \
        -F "run_id=$RUN_ID" \
        -F "file=@$TESTDATA_DIR/profile-events.json")
    echo "✅ 性能事件导入成功"
else
    echo "⚠️  未找到 profile-events.json 文件，跳过事件导入"
fi
echo ""

# 查看运行结果
echo "10. 查看运行结果详情..."
RUN_DETAIL=$(curl -s "$BASE_URL/api/v1/runs/$RUN_ID")
echo "$RUN_DETAIL" | python3 -m json.tool 2>/dev/null || echo "$RUN_DETAIL"
echo ""

# 与基线对比
echo "11. 与基线数据对比..."
COMPARISON=$(curl -s "$BASE_URL/api/v1/compare?run_id=$RUN_ID")
echo "$COMPARISON" | python3 -m json.tool 2>/dev/null || echo "$COMPARISON"
echo ""

# 慢路径归因分析
echo "12. 慢路径归因分析..."
ATTRIBUTION=$(curl -s "$BASE_URL/api/v1/analysis/attribution?run_id=$RUN_ID")
echo "$ATTRIBUTION" | python3 -m json.tool 2>/dev/null || echo "$ATTRIBUTION"
echo ""

# 导出 JSON 报告
echo "13. 导出 JSON 报告..."
mkdir -p ./output
curl -s "$BASE_URL/api/v1/reports/1/export?format=json" > ./output/report.json 2>/dev/null || \
curl -s "$BASE_URL/api/v1/reports/export?run_id=$RUN_ID&format=json" > ./output/report.json 2>/dev/null

if [ -f "./output/report.json" ] && [ -s "./output/report.json" ]; then
    echo "✅ JSON 报告已保存到: ./output/report.json"
else
    echo "⚠️  JSON 报告导出可能失败，请检查 API"
fi
echo ""

# 导出 Markdown 报告
echo "14. 导出 Markdown 报告..."
curl -s "$BASE_URL/api/v1/reports/1/export?format=markdown" > ./output/report.md 2>/dev/null || \
curl -s "$BASE_URL/api/v1/reports/export?run_id=$RUN_ID&format=markdown" > ./output/report.md 2>/dev/null

if [ -f "./output/report.md" ] && [ -s "./output/report.md" ]; then
    echo "✅ Markdown 报告已保存到: ./output/report.md"
else
    echo "⚠️  Markdown 报告导出可能失败，请检查 API"
fi
echo ""

# 导出 CSV 报告
echo "15. 导出 CSV 报告..."
curl -s "$BASE_URL/api/v1/reports/1/export?format=csv" > ./output/report.csv 2>/dev/null || \
curl -s "$BASE_URL/api/v1/reports/export?run_id=$RUN_ID&format=csv" > ./output/report.csv 2>/dev/null

if [ -f "./output/report.csv" ] && [ -s "./output/report.csv" ]; then
    echo "✅ CSV 报告已保存到: ./output/report.csv"
else
    echo "⚠️  CSV 报告导出可能失败，请检查 API"
fi
echo ""

echo "=========================================="
echo "演示流程完成！"
echo "=========================================="
echo ""
echo "项目 ID: $PROJECT_ID"
echo "运行任务 ID: $RUN_ID"
echo ""
echo "可用的 API 端点:"
echo "  - 项目管理: $BASE_URL/api/v1/projects"
echo "  - 运行任务: $BASE_URL/api/v1/runs"
echo "  - 基线对比: $BASE_URL/api/v1/compare?run_id=$RUN_ID"
echo "  - 归因分析: $BASE_URL/api/v1/analysis/attribution?run_id=$RUN_ID"
echo ""
echo "输出文件:"
echo "  - ./output/report.json (JSON 报告)"
echo "  - ./output/report.md (Markdown 报告)"
echo "  - ./output/report.csv (CSV 报告)"
echo ""
