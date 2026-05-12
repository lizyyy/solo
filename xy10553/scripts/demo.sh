#!/bin/bash

BASE_URL="${BASE_URL:-http://localhost:3000}"

echo "=========================================="
echo "  机房访客陪同 API 完整演示脚本"
echo "  服务地址: $BASE_URL"
echo "=========================================="
echo ""

section() {
    echo ""
    echo "=================================================="
    echo "  $1"
    echo "=================================================="
}

hr() {
    echo "--------------------------------------------------"
}

pretty_print() {
    if command -v jq > /dev/null 2>&1; then
        echo "$1" | jq '.' 2>/dev/null || echo "$1"
    else
        echo "$1"
    fi
}

check_server() {
    section "0. 检查服务状态"
    response=$(curl -s "$BASE_URL/health")
    status=$(echo "$response" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
    if [ "$status" = "ok" ]; then
        echo "✅ 服务运行正常"
        return 0
    else
        echo "❌ 服务未响应，请先启动服务: npm start"
        exit 1
    fi
}

create_application() {
    section "1. 创建访客申请"
    
    IDEM_KEY="demo-app-$(date +%s)"
    
    response=$(curl -s -X POST "$BASE_URL/api/visitors/applications" \
        -H "Content-Type: application/json" \
        -H "X-Idempotency-Key: $IDEM_KEY" \
        -d '{
            "name": "演示访客",
            "phone": "13800001111",
            "company": "演示科技有限公司",
            "idCard": "110101198801019999",
            "purpose": "系统维护演示",
            "visitorType": "EXTERNAL",
            "approverId": "APPR001",
            "companionId": "COMP001",
            "companionName": "张工程师",
            "devices": [
                { "type": "笔记本电脑", "brand": "Dell", "model": "XPS 13", "serialNumber": "DEMO-LAP-001" },
                { "type": "移动硬盘", "brand": "Seagate", "model": "Backup Plus", "serialNumber": "DEMO-HDD-001" }
            ],
            "operatorId": "DEMO-OPERATOR"
        }')
    
    hr
    echo "创建响应:"
    pretty_print "$response"
    
    VISITOR_ID=$(echo "$response" | grep -o '"visitorId":"[^"]*"' | cut -d'"' -f4)
    echo ""
    echo "访客ID: $VISITOR_ID"
    
    section "1a. 幂等测试 - 重复创建申请"
    response2=$(curl -s -X POST "$BASE_URL/api/visitors/applications" \
        -H "Content-Type: application/json" \
        -H "X-Idempotency-Key: $IDEM_KEY" \
        -d '{
            "name": "演示访客",
            "idCard": "110101198801019999"
        }')
    hr
    echo "重复创建响应:"
    pretty_print "$response2"
    
    export VISITOR_ID
}

approve_application() {
    section "2. 审批通过"
    
    if [ -z "$VISITOR_ID" ]; then
        echo "❌ 请先创建访客申请"
        exit 1
    fi
    
    response=$(curl -s -X POST "$BASE_URL/api/visitors/applications/$VISITOR_ID/approve" \
        -H "Content-Type: application/json" \
        -d '{
            "approverId": "APPR001",
            "approverName": "赵总监",
            "notes": "同意访问，需全程陪同",
            "operatorId": "APPR001"
        }')
    
    hr
    echo "审批响应:"
    pretty_print "$response"
    
    NEW_STATUS=$(echo "$response" | grep -o '"newStatus":"[^"]*"' | cut -d'"' -f4)
    echo ""
    echo "状态变化: APPLIED -> $NEW_STATUS"
}

confirm_companion() {
    section "3. 陪同人确认"
    
    response=$(curl -s -X POST "$BASE_URL/api/visitors/applications/$VISITOR_ID/confirm-companion" \
        -H "Content-Type: application/json" \
        -d '{
            "companionId": "COMP001",
            "companionName": "张工程师",
            "operatorId": "COMP001"
        }')
    
    hr
    echo "陪同确认响应:"
    pretty_print "$response"
    
    NEW_STATUS=$(echo "$response" | grep -o '"newStatus":"[^"]*"' | cut -d'"' -f4)
    echo ""
    echo "状态变化: APPROVED -> $NEW_STATUS"
}

check_in() {
    section "4. 入场核销"
    
    response=$(curl -s -X POST "$BASE_URL/api/visitors/applications/$VISITOR_ID/check-in" \
        -H "Content-Type: application/json" \
        -d '{
            "operatorId": "GUARD-DEMO"
        }')
    
    hr
    echo "入场响应:"
    pretty_print "$response"
    
    NEW_STATUS=$(echo "$response" | grep -o '"newStatus":"[^"]*"' | cut -d'"' -f4)
    echo ""
    echo "状态变化: COMPANION_CONFIRMED -> $NEW_STATUS"
}

query_status() {
    section "5. 查询访客当前状态"
    
    response=$(curl -s "$BASE_URL/api/visitors/applications/$VISITOR_ID")
    
    hr
    echo "访客详情:"
    pretty_print "$response"
    
    CURRENT_STATUS=$(echo "$response" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
    DEVICE_COUNT=$(echo "$response" | grep -o '"type":"[^"]*"' | wc -l)
    EXCEPTION_COUNT=$(echo "$response" | grep -o '"exceptions":\[' -A 1000 | grep -c '"id"')
    
    echo ""
    echo "当前状态: $CURRENT_STATUS"
    echo "设备数量: $DEVICE_COUNT"
    echo "异常数量: $EXCEPTION_COUNT"
}

query_history() {
    section "6. 查询历史操作记录"
    
    response=$(curl -s "$BASE_URL/api/visitors/applications/$VISITOR_ID/history")
    
    hr
    echo "历史记录:"
    pretty_print "$response"
    
    EVENT_COUNT=$(echo "$response" | grep -o '"eventType":"[^"]*"' | wc -l)
    echo ""
    echo "历史事件数: $EVENT_COUNT"
}

query_timeline() {
    section "7. 查询访客时间线"
    
    response=$(curl -s "$BASE_URL/api/visitors/timeline/$VISITOR_ID")
    
    hr
    echo "时间线:"
    pretty_print "$response"
}

check_out_normal() {
    section "8. 离场核销（正常带出所有设备）"
    
    response=$(curl -s -X POST "$BASE_URL/api/visitors/applications/$VISITOR_ID/check-out" \
        -H "Content-Type: application/json" \
        -d '{
            "operatorId": "GUARD-DEMO"
        }')
    
    hr
    echo "离场响应:"
    pretty_print "$response"
    
    NEW_STATUS=$(echo "$response" | grep -o '"newStatus":"[^"]*"' | cut -d'"' -f4)
    echo ""
    echo "状态变化: CHECKED_IN -> $NEW_STATUS"
}

demo_failure_path() {
    section "========== 失败路径演示 =========="
    
    section "F1. 创建另一个访客申请 - 演示审批缺失失败"
    
    IDEM_KEY_F1="demo-fail-$(date +%s)"
    
    response=$(curl -s -X POST "$BASE_URL/api/visitors/applications" \
        -H "Content-Type: application/json" \
        -d '{
            "name": "失败演示访客",
            "idCard": "110101199912318888",
            "purpose": "测试审批缺失",
            "approverId": "APPR001",
            "companionId": "COMP002",
            "devices": [
                {"type": "笔记本电脑", "serialNumber": "SN-LAP-999"},
                {"type": "U盘", "serialNumber": "SN-USB-999"}
            ],
            "operatorId": "TEST-OP"
        }')
    
    FAIL_VISITOR_ID=$(echo "$response" | grep -o '"visitorId":"[^"]*"' | cut -d'"' -f4)
    echo "创建的访客ID: $FAIL_VISITOR_ID"
    
    section "F2. 跳过审批，直接尝试入场 - 应失败"
    
    response=$(curl -s -X POST "$BASE_URL/api/visitors/applications/$FAIL_VISITOR_ID/check-in" \
        -H "Content-Type: application/json" \
        -d '{"operatorId": "GUARD-TEST"}')
    
    hr
    echo "入场失败响应:"
    pretty_print "$response"
    
    ERROR_TYPE=$(echo "$response" | grep -o '"error":"[^"]*"' | cut -d'"' -f4)
    echo ""
    echo "错误类型: $ERROR_TYPE"
    
    section "F3. 先审批，再跳过陪同确认，尝试入场 - 应失败"
    
    response=$(curl -s -X POST "$BASE_URL/api/visitors/applications/$FAIL_VISITOR_ID/approve" \
        -H "Content-Type: application/json" \
        -d '{"approverId": "APPR001", "operatorId": "APPR001"}')
    
    response=$(curl -s -X POST "$BASE_URL/api/visitors/applications/$FAIL_VISITOR_ID/check-in" \
        -H "Content-Type: application/json" \
        -d '{"operatorId": "GUARD-TEST"}')
    
    hr
    echo "入场失败响应（无陪同）:"
    pretty_print "$response"
    
    section "F4. 完成陪同确认后入场 - 成功"
    
    response=$(curl -s -X POST "$BASE_URL/api/visitors/applications/$FAIL_VISITOR_ID/confirm-companion" \
        -H "Content-Type: application/json" \
        -d '{"companionId": "COMP002", "companionName": "李主管", "operatorId": "COMP002"}')
    
    response=$(curl -s -X POST "$BASE_URL/api/visitors/applications/$FAIL_VISITOR_ID/check-in" \
        -H "Content-Type: application/json" \
        -d '{"operatorId": "GUARD-TEST"}')
    
    hr
    echo "入场成功响应:"
    pretty_print "$response"
    
    section "F5. 离场时模拟设备未带出"
    
    response=$(curl -s -X POST "$BASE_URL/api/visitors/applications/$FAIL_VISITOR_ID/check-out" \
        -H "Content-Type: application/json" \
        -d '{
            "leftBehindDeviceSerials": ["SN-LAP-999"],
            "operatorId": "GUARD-TEST"
        }')
    
    hr
    echo "离场响应（设备未带出）:"
    pretty_print "$response"
    
    EXCEPTION_MSG=$(echo "$response" | grep -o '"message":"[^"]*设备[^"]*"' | head -1 | cut -d'"' -f4)
    echo ""
    echo "设备异常: $EXCEPTION_MSG"
    
    export FAIL_VISITOR_ID
}

demo_manual_correction() {
    section "========== 人工修正演示 =========="
    
    section "M1. 查看修正前状态"
    
    response=$(curl -s "$BASE_URL/api/visitors/applications/$FAIL_VISITOR_ID")
    BEFORE_STATUS=$(echo "$response" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
    echo "修正前状态: $BEFORE_STATUS"
    
    section "M2. 执行人工修正 - 标记设备已带出"
    
    response=$(curl -s -X POST "$BASE_URL/api/visitors/applications/$FAIL_VISITOR_ID/correct" \
        -H "Content-Type: application/json" \
        -d '{
            "newStatus": "CHECKED_OUT",
            "devices": [
                { "type": "笔记本电脑", "checkedOut": true, "checkedOutAt": '$(date +%s)000' }
            ],
            "notes": "安保复核确认设备已带出，人工修正",
            "operatorId": "AUDIT-MANAGER"
        }')
    
    hr
    echo "人工修正响应:"
    pretty_print "$response"
    
    section "M3. 查看修正后的历史差异"
    
    response=$(curl -s "$BASE_URL/api/visitors/applications/$FAIL_VISITOR_ID/history")
    
    hr
    echo "历史记录（含人工修正差异）:"
    if command -v jq > /dev/null 2>&1; then
        echo "$response" | jq '.data.history[-1] | {eventType, operatorId, diff}'
    else
        pretty_print "$response"
    fi
}

export_audit_report() {
    section "========== 导出审计报告 =========="
    
    section "R1. 获取审计报告（JSON格式）"
    
    response=$(curl -s "$BASE_URL/api/visitors/reports/audit")
    
    hr
    echo "报告摘要:"
    if command -v jq > /dev/null 2>&1; then
        echo "$response" | jq '.data.summary'
    else
        TOTAL=$(echo "$response" | grep -o '"totalApplications":[0-9]*' | cut -d: -f2)
        ACTIVE=$(echo "$response" | grep -o '"activeVisitors":[0-9]*' | cut -d: -f2)
        TIMEOUT=$(echo "$response" | grep -o '"timeoutCount":[0-9]*' | cut -d: -f2)
        DEVICES_LEFT=$(echo "$response" | grep -o '"devicesLeftBehind":[0-9]*' | cut -d: -f2)
        echo "总申请数: $TOTAL"
        echo "当前在场: $ACTIVE"
        echo "超时记录: $TIMEOUT"
        echo "设备遗留: $DEVICES_LEFT"
    fi
    
    section "R2. 下载审计报告为文件"
    
    REPORT_FILE="audit-report-$(date +%Y%m%d-%H%M%S).json"
    curl -s "$BASE_URL/api/visitors/reports/audit?format=download" > "$REPORT_FILE"
    echo "报告已保存: $REPORT_FILE"
    echo "文件大小: $(wc -c < "$REPORT_FILE") 字节"
}

demo_list_all() {
    section "========== 查看所有访客列表 =========="
    
    response=$(curl -s "$BASE_URL/api/visitors/applications")
    
    hr
    echo "访客列表:"
    if command -v jq > /dev/null 2>&1; then
        echo "$response" | jq '.data.visitors[] | {id, name, status, exceptionCount}'
    else
        pretty_print "$response"
    fi
}

demo_check_exceptions() {
    section "========== 查看带异常的访客 =========="
    
    response=$(curl -s "$BASE_URL/api/visitors/applications?hasExceptions=true")
    
    hr
    echo "异常访客列表:"
    if command -v jq > /dev/null 2>&1; then
        echo "$response" | jq '.data.visitors[] | {id, name, status, exceptionCount}'
    else
        pretty_print "$response"
    fi
}

demo_summary() {
    echo ""
    echo "=================================================="
    echo "  演示完成！关键信息汇总"
    echo "=================================================="
    echo ""
    echo "【正常流程访客】"
    echo "  ID: $VISITOR_ID"
    echo "  完整生命周期: APPLIED -> APPROVED -> COMPANION_CONFIRMED -> CHECKED_IN -> CHECKED_OUT"
    echo ""
    echo "【失败路径演示访客】"
    echo "  ID: $FAIL_VISITOR_ID"
    echo "  演示了:"
    echo "    - 审批缺失导致入场失败"
    echo "    - 陪同未确认导致入场失败"
    echo "    - 设备未带出异常"
    echo "    - 人工修正（含差异记录）"
    echo ""
    echo "【可用查询接口】"
    echo "  curl $BASE_URL/api/visitors/applications/$VISITOR_ID"
    echo "  curl $BASE_URL/api/visitors/applications/$VISITOR_ID/history"
    echo "  curl $BASE_URL/api/visitors/timeline/$VISITOR_ID"
    echo "  curl $BASE_URL/api/visitors/reports/audit"
    echo ""
    echo "【审计报告】"
    echo "  已生成: 查看当前目录下的 audit-report-*.json"
    echo ""
    echo "=================================================="
}

check_server

create_application
query_status

approve_application
query_status

confirm_companion
query_status

check_in
query_status

query_history
query_timeline

check_out_normal
query_status

demo_failure_path

demo_manual_correction

demo_list_all
demo_check_exceptions

export_audit_report

demo_summary
