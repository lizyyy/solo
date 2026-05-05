#!/bin/bash

# 用印室管理系统 API 测试脚本
# 基础 URL
BASE_URL="http://localhost:5001/api"

echo "===================================="
echo "用印室管理系统 API 测试脚本"
echo "===================================="
echo ""

# 函数：发送 POST 请求
post_request() {
    local endpoint="$1"
    local data="$2"
    echo "POST $BASE_URL$endpoint"
    curl -s -X POST "$BASE_URL$endpoint" \
        -H "Content-Type: application/json" \
        -d "$data"
    echo ""
    echo "------------------------------------"
}

# 函数：发送 GET 请求
get_request() {
    local endpoint="$1"
    echo "GET $BASE_URL$endpoint"
    curl -s "$BASE_URL$endpoint"
    echo ""
    echo "------------------------------------"
}

# 函数：上传文件
upload_file() {
    local endpoint="$1"
    local file_path="$2"
    echo "POST $BASE_URL$endpoint (上传文件: $file_path)"
    curl -s -X POST "$BASE_URL$endpoint" \
        -F "file=@$file_path"
    echo ""
    echo "------------------------------------"
}

echo "1. 初始化基础数据 - 创建印章"
echo "------------------------------------"

# 创建公章
post_request "/stamps" '{
    "stamp_code": "STAMP-001",
    "stamp_name": "公司公章",
    "stamp_type": "公章",
    "status": "in_cabinet",
    "location": "印章柜A-01"
}'

# 创建合同专用章
post_request "/stamps" '{
    "stamp_code": "STAMP-002",
    "stamp_name": "合同专用章",
    "stamp_type": "合同章",
    "status": "in_cabinet",
    "location": "印章柜A-02"
}'

# 创建财务专用章
post_request "/stamps" '{
    "stamp_code": "STAMP-003",
    "stamp_name": "财务专用章",
    "stamp_type": "财务章",
    "status": "in_cabinet",
    "location": "印章柜B-01"
}'

echo ""
echo "2. 导入授权名单"
echo "------------------------------------"
upload_file "/authorizations/import" "examples/authorizations.csv"

echo ""
echo "3. 导入用印申请"
echo "------------------------------------"
upload_file "/applications/import" "examples/stamp_applications.csv"

echo ""
echo "4. 导入印章柜开关日志"
echo "------------------------------------"
upload_file "/cabinet-logs/import" "examples/cabinet_logs.json"

echo ""
echo "5. 导入寄章快递表"
echo "------------------------------------"
upload_file "/express-deliveries/import" "examples/express_deliveries.csv"

echo ""
echo "6. 查询所有用印申请"
echo "------------------------------------"
get_request "/applications"

echo ""
echo "7. 计算所有待处理申请的风险"
echo "------------------------------------"
post_request "/risk/calculate-all" "{}"

echo ""
echo "8. 获取风险概览"
echo "------------------------------------"
get_request "/risk/summary"

echo ""
echo "9. 检查逾期外借记录"
echo "------------------------------------"
post_request "/risk/check-overdue" "{}"

echo ""
echo "10. 检查未授权访问记录"
echo "------------------------------------"
post_request "/risk/check-unauthorized" "{}"

echo ""
echo "11. 创建外借记录（模拟印章外借）"
echo "------------------------------------"
post_request "/loans" '{
    "loan_number": "LOAN-2026-0001",
    "stamp_code": "STAMP-002",
    "borrower_id": "E002",
    "borrower_name": "李四",
    "borrower_department": "市场部",
    "loan_reason": "外出签署合作协议",
    "loan_date": "2026-05-05",
    "expected_return_date": "2026-05-08",
    "status": "on_loan"
}'

echo ""
echo "12. 人工复核（改判申请状态）"
echo "------------------------------------"
post_request "/reviews" '{
    "application_id": 1,
    "reviewer_id": "ADMIN001",
    "reviewer_name": "管理员",
    "new_status": "approved",
    "notes": "经人工复核，该申请材料齐全，符合用印规定，同意盖章。",
    "risk_override": true,
    "risk_adjustment": -50.0
}'

echo ""
echo "13. 查询特定申请的风险评估详情"
echo "------------------------------------"
get_request "/risk/assessment/1"

echo ""
echo "14. 导出单个申请的用印交接单 (Markdown)"
echo "------------------------------------"
echo "GET $BASE_URL/export/handover/1"
curl -s -o "handover_example.md" "$BASE_URL/export/handover/1"
echo "交接单已保存到 handover_example.md"
echo "------------------------------------"

echo ""
echo "15. 导出审计包 (JSON)"
echo "------------------------------------"
echo "GET $BASE_URL/export/audit?start_date=2026-05-01&end_date=2026-05-31"
curl -s -o "audit_package_example.json" "$BASE_URL/export/audit?start_date=2026-05-01&end_date=2026-05-31"
echo "审计包已保存到 audit_package_example.json"
echo "------------------------------------"

echo ""
echo "16. 查询所有印章状态"
echo "------------------------------------"
get_request "/stamps"

echo ""
echo "17. 查询所有外借记录"
echo "------------------------------------"
get_request "/loans"

echo ""
echo "===================================="
echo "API 测试完成"
echo "===================================="
echo ""
echo "提示："
echo "1. 请确保服务已在 http://localhost:5001 运行"
echo "2. 可查看生成的 handover_example.md 和 audit_package_example.json"
echo "3. 可使用 curl 命令直接调用各 API 接口"
