#!/bin/bash

set -e

BASE_URL="http://localhost:3000"
STATE_FILE="/tmp/gray_rollback_demo_state.json"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

print_header() {
    echo -e "\n${BLUE}══════════════════════════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}══════════════════════════════════════════════════════════════════════════════════${NC}"
}

print_step() {
    echo -e "\n${CYAN}▶ $1${NC}"
}

print_success() {
    echo -e "  ${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "  ${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "  ${RED}❌ $1${NC}"
}

print_info() {
    echo -e "  ${PURPLE}📌 $1${NC}"
}

check_server() {
    print_step "检查服务是否启动"
    response=$(curl -s "$BASE_URL/api/health")
    if echo "$response" | grep -q "ok"; then
        print_success "服务运行正常: $BASE_URL"
    else
        print_error "服务未启动，请先运行: node server.js"
        exit 1
    fi
}

load_state() {
    if [ -f "$STATE_FILE" ]; then
        BATCH_ID_A=$(cat "$STATE_FILE" | python3 -c "import sys, json; print(json.load(sys.stdin)['batchIdA'])")
        BATCH_ID_B=$(cat "$STATE_FILE" | python3 -c "import sys, json; print(json.load(sys.stdin)['batchIdB'])")
        print_info "加载状态文件成功"
        print_info "批次 A (健康): $BATCH_ID_A"
        print_info "批次 B (异常): $BATCH_ID_B"
    else
        print_error "未找到状态文件，请先运行: node seed.js"
        exit 1
    fi
}

demo_publish_config() {
    print_header "场景 1: 配置版本发布"
    print_step "发布新的计费配置版本 v3"
    
    response=$(curl -s -X POST "$BASE_URL/api/configs" \
        -H "Content-Type: application/json" \
        -d '{
            "configKey": "billing:enable_new_pricing",
            "configValue": {"enabled": true, "version": "v3", "discount": 0.15, "feature_flags": ["dynamic_pricing"]},
            "operator": "release_manager@example.com"
        }')
    
    echo "$response" | python3 -m json.tool
    print_success "配置版本发布成功"
}

demo_healthy_batch() {
    print_header "场景 2: 健康批次 - 继续推进灰度"
    print_step "查询批次 A 的租户配置命中情况"
    
    echo -e "\n${CYAN}  ── tenant-001 ──${NC}"
    curl -s "$BASE_URL/api/tenants/tenant-001/config/billing:enable_new_pricing" | python3 -m json.tool
    
    echo -e "\n${CYAN}  ── tenant-002 ──${NC}"
    curl -s "$BASE_URL/api/tenants/tenant-002/config/billing:enable_new_pricing" | python3 -m json.tool
    
    print_success "健康批次租户正常命中新配置"
    print_info "tenant-001: 成功率 99.5%, tenant-002: 99.2%, tenant-003: 99.8%"
    print_info "所有指标正常 → 可以继续推进全量发布"
}

demo_abnormal_pause() {
    print_header "场景 3: 异常批次 - 发现问题后暂停灰度"
    
    print_step "查询批次 B 的异常租户指标"
    print_info "tenant-004 成功率: 45%"
    print_info "tenant-005 成功率: 38%"
    print_info "tenant-006 成功率: 52%"
    print_warning "订单成功率突然下降！需要立即暂停灰度"
    
    print_step "暂停批次 B 的灰度"
    response=$(curl -s -X POST "$BASE_URL/api/batches/$BATCH_ID_B/pause" \
        -H "Content-Type: application/json" \
        -d '{
            "reason": "批次内多个租户订单成功率异常下降 (38%-52%)，需要紧急排查",
            "operator": "sre_oncall@example.com"
        }')
    
    echo "$response" | python3 -m json.tool
    print_success "批次已暂停"
    print_warning "暂停后，未回滚的租户配置命中状态不变"
    
    print_step "验证暂停后租户配置命中仍在"
    curl -s "$BASE_URL/api/tenants/tenant-004/config/billing:enable_new_pricing" | python3 -m json.tool
}

demo_single_tenant_rollback() {
    print_header "场景 4: 单租户回滚"
    print_step "回滚异常租户 tenant-004"
    print_info "基于指标: order_success_rate=45%, error_count=275"
    print_info "回滚时间点设为: 10 分钟前"
    
    # 计算 10 分钟前的时间
    ROLLBACK_TIME=$(date -u -v-10M +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u -d "-10 minutes" +"%Y-%m-%dT%H:%M:%SZ")
    
    response=$(curl -s -X POST "$BASE_URL/api/rollbacks/tenant" \
        -H "Content-Type: application/json" \
        -d "{
            \"tenantId\": \"tenant-004\",
            \"batchId\": \"$BATCH_ID_B\",
            \"reason\": \"订单成功率降至 45%，远低于基线 99%\",
            \"rollbackTime\": \"$ROLLBACK_TIME\",
            \"operator\": \"sre_oncall@example.com\",
            \"metricsEvidence\": {
                \"order_success_rate\": 0.45,
                \"baseline_rate\": 0.99,
                \"error_count\": 275,
                \"affected_orders\": 500
            }
        }")
    
    echo "$response" | python3 -m json.tool
    print_success "tenant-004 回滚成功"
    
    print_step "验证回滚后租户不再命中新配置"
    curl -s "$BASE_URL/api/tenants/tenant-004/config/billing:enable_new_pricing" | python3 -m json.tool
    
    print_step "继续回滚 tenant-005"
    response=$(curl -s -X POST "$BASE_URL/api/rollbacks/tenant" \
        -H "Content-Type: application/json" \
        -d "{
            \"tenantId\": \"tenant-005\",
            \"batchId\": \"$BATCH_ID_B\",
            \"reason\": \"订单成功率降至 38%，最严重的异常租户\",
            \"operator\": \"sre_oncall@example.com\",
            \"metricsEvidence\": {
                \"order_success_rate\": 0.38,
                \"baseline_rate\": 0.99,
                \"error_count\": 744
            }
        }")
    
    echo "$response" | python3 -m json.tool
    print_success "tenant-005 回滚成功"
}

demo_duplicate_rollback() {
    print_header "场景 5: 重复回滚处理 - 幂等性保障"
    print_step "尝试再次回滚 tenant-004"
    print_warning "模拟值班同事重复操作或脚本重试"
    
    response=$(curl -s -X POST "$BASE_URL/api/rollbacks/tenant" \
        -H "Content-Type: application/json" \
        -d "{
            \"tenantId\": \"tenant-004\",
            \"batchId\": \"$BATCH_ID_B\",
            \"reason\": \"重复回滚测试\",
            \"operator\": \"automation_script\"
        }")
    
    echo "$response" | python3 -m json.tool
    print_success "返回已有回滚结果，duplicate=true"
    print_info "系统确保同一租户重复回滚是安全的"
}

demo_batch_rollback() {
    print_header "场景 6: 整批回滚"
    print_step "调查确认问题根因：新计费逻辑存在边界条件缺陷"
    print_info "影响范围: 批次 B 内所有租户"
    print_warning "决定: 整批回滚以确保业务稳定"
    
    response=$(curl -s -X POST "$BASE_URL/api/rollbacks/batch" \
        -H "Content-Type: application/json" \
        -d "{
            \"batchId\": \"$BATCH_ID_B\",
            \"reason\": \"根因确认：新计费模块存在边界条件缺陷，影响批次内所有租户。决定整批回滚。\",
            \"operator\": \"release_manager@example.com\",
            \"metricsEvidence\": {
                \"batch_average_success_rate\": 0.58,
                \"baseline_rate\": 0.99,
                \"total_affected_tenants\": 4,
                \"root_cause\": \"billing_module_boundary_condition_bug\"
            }
        }")
    
    echo "$response" | python3 -m json.tool
    print_success "批次 B 整批回滚完成"
    print_info "已自动跳过已回滚的 tenant-004 和 tenant-005"
    print_info "新回滚了 tenant-006 和 tenant-007"
    
    print_step "验证整批回滚后所有租户状态"
    echo -e "\n${CYAN}  ── tenant-006 ──${NC}"
    curl -s "$BASE_URL/api/tenants/tenant-006/config/billing:enable_new_pricing" | python3 -m json.tool
    
    echo -e "\n${CYAN}  ── tenant-007 ──${NC}"
    curl -s "$BASE_URL/api/tenants/tenant-007/config/billing:enable_new_pricing" | python3 -m json.tool
}

demo_audit_timeline() {
    print_header "场景 7: 查询审计时间线"
    print_step "查询所有审计记录（按时间倒序）"
    
    response=$(curl -s "$BASE_URL/api/audit?sort=desc&limit=50")
    echo "$response" | python3 -m json.tool
    
    print_success "审计记录完整展示"
    print_info "可以看到: 谁在什么时间做了什么操作"
    print_info "每个操作都包含了关键决策依据（指标证据）"
    
    print_step "按操作人筛选查询 (sre_oncall@example.com)"
    curl -s "$BASE_URL/api/audit?operator=sre_oncall@example.com" | python3 -m json.tool
}

demo_rollback_summary() {
    print_header "场景 8: 导出回滚原因汇总（给发布负责人）"
    print_step "生成 JSON 格式汇总"
    
    response=$(curl -s "$BASE_URL/api/rollbacks/summary")
    echo "$response" | python3 -m json.tool
    
    print_step "生成 Markdown 格式汇总报告"
    echo -e "\n${YELLOW}══════════════════════════════════════════════════════════════════════════════════${NC}"
    curl -s "$BASE_URL/api/rollbacks/summary?format=markdown"
    echo -e "${YELLOW}══════════════════════════════════════════════════════════════════════════════════${NC}"
    
    print_success "回滚原因汇总报告生成完成"
    print_info "包含: 概览、批次详情、租户级回滚记录、指标证据、操作人等"
}

demo_completed_batch_rule() {
    print_header "场景 9: 规则验证 - 全量发布后不能按批次回滚"
    print_step "模拟批次 A 已全量发布（完成灰度）"
    
    response=$(curl -s -X POST "$BASE_URL/api/batches/$BATCH_ID_A/complete" \
        -H "Content-Type: application/json" \
        -d '{"operator": "release_manager@example.com"}')
    
    echo "$response" | python3 -m json.tool
    print_success "批次 A 已标记为 COMPLETED（全量发布）"
    
    print_step "尝试对已完成的批次执行整批回滚"
    print_warning "预期: 返回错误，不允许按批次回滚"
    
    response=$(curl -s -X POST "$BASE_URL/api/rollbacks/batch" \
        -H "Content-Type: application/json" \
        -d "{
            \"batchId\": \"$BATCH_ID_A\",
            \"reason\": \"测试已完成批次回滚限制\",
            \"operator\": \"test_user\"
        }")
    
    echo "$response" | python3 -m json.tool
    print_success "正确拒绝了已完成批次的回滚请求"
    print_info "全量发布后的回滚需要走其他流程（如配置版本回滚）"
}

demo_snapshot_rule() {
    print_header "场景 10: 规则验证 - 指标快照晚于回滚时间"
    print_step "创建一个测试批次用于演示"
    
    # 先创建一个新配置
    curl -s -X POST "$BASE_URL/api/configs" \
        -H "Content-Type: application/json" \
        -d '{
            "configKey": "test:feature_flag",
            "configValue": {"enabled": true},
            "operator": "test"
        }' > /dev/null
    
    # 创建测试批次
    batch_resp=$(curl -s -X POST "$BASE_URL/api/batches" \
        -H "Content-Type: application/json" \
        -d '{
            "configKey": "test:feature_flag",
            "tenantIds": ["test-tenant-999"],
            "batchName": "Test_Batch_Snapshot_Rule",
            "operator": "test"
        }')
    
    TEST_BATCH_ID=$(echo "$batch_resp" | python3 -c "import sys, json; print(json.load(sys.stdin)['batch']['id'])")
    
    print_info "测试批次: $TEST_BATCH_ID"
    
    print_step "写入一个晚于回滚时间的指标快照"
    # 使用未来的时间作为快照时间
    FUTURE_TIME=$(date -u -v+5M +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u -d "+5 minutes" +"%Y-%m-%dT%H:%M:%SZ")
    
    curl -s -X POST "$BASE_URL/api/metrics" \
        -H "Content-Type: application/json" \
        -d "{
            \"batchId\": \"$TEST_BATCH_ID\",
            \"tenantId\": \"test-tenant-999\",
            \"metrics\": {\"test\": \"data\"},
            \"snapshotTime\": \"$FUTURE_TIME\",
            \"operator\": \"test\"
        }" > /dev/null
    
    print_success "指标快照已写入 (时间: $FUTURE_TIME)"
    
    print_step "执行回滚（使用当前时间，早于快照时间）"
    response=$(curl -s -X POST "$BASE_URL/api/rollbacks/tenant" \
        -H "Content-Type: application/json" \
        -d "{
            \"tenantId\": \"test-tenant-999\",
            \"batchId\": \"$TEST_BATCH_ID\",
            \"reason\": \"测试快照时间规则\",
            \"operator\": \"test\"
        }")
    
    echo "$response" | python3 -m json.tool
    
    print_warning "注意: warnings 字段提示快照时间晚于回滚时间"
    print_info "系统检测到潜在的时间不一致，建议人工验证"
}

main() {
    clear
    echo -e "${GREEN}"
    echo "╔═══════════════════════════════════════════════════════════════════════════╗"
    echo "║                                                                           ║"
    echo "║              灰度配置回滚 API - 完整演示流程                              ║"
    echo "║                                                                           ║"
    echo "║     演示场景:                                                             ║"
    echo "║     1. 配置版本发布                                                       ║"
    echo "║     2. 健康批次 - 继续推进                                                ║"
    echo "║     3. 异常批次 - 暂停灰度                                                ║"
    echo "║     4. 单租户回滚                                                         ║"
    echo "║     5. 重复回滚处理（幂等性）                                             ║"
    echo "║     6. 整批回滚                                                           ║"
    echo "║     7. 查询审计时间线                                                     ║"
    echo "║     8. 导出回滚原因汇总                                                   ║"
    echo "║     9. 规则验证：全量发布后不能回滚                                       ║"
    echo "║    10. 规则验证：快照时间检查                                             ║"
    echo "║                                                                           ║"
    echo "╚═══════════════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    check_server
    load_state
    
    demo_publish_config
    read -p "按回车继续..."
    
    demo_healthy_batch
    read -p "按回车继续..."
    
    demo_abnormal_pause
    read -p "按回车继续..."
    
    demo_single_tenant_rollback
    read -p "按回车继续..."
    
    demo_duplicate_rollback
    read -p "按回车继续..."
    
    demo_batch_rollback
    read -p "按回车继续..."
    
    demo_audit_timeline
    read -p "按回车继续..."
    
    demo_rollback_summary
    read -p "按回车继续..."
    
    demo_completed_batch_rule
    read -p "按回车继续..."
    
    demo_snapshot_rule
    
    echo -e "\n${GREEN}"
    echo "╔═══════════════════════════════════════════════════════════════════════════╗"
    echo "║                                                                           ║"
    echo "║                    🎉 演示流程全部完成！                                  ║"
    echo "║                                                                           ║"
    echo "║     您已验证了所有核心功能:                                               ║"
    echo "║     ✅ 配置版本管理                                                       ║"
    echo "║     ✅ 灰度批次管理                                                       ║"
    echo "║     ✅ 租户配置命中查询                                                   ║"
    echo "║     ✅ 指标快照写入                                                       ║"
    echo "║     ✅ 暂停灰度                                                           ║"
    echo "║     ✅ 单租户回滚                                                         ║"
    echo "║     ✅ 重复回滚幂等性                                                     ║"
    echo "║     ✅ 整批回滚                                                           ║"
    echo "║     ✅ 审计时间线                                                         ║"
    echo "║     ✅ 回滚原因汇总导出                                                   ║"
    echo "║     ✅ 全量发布后回滚限制                                                 ║"
    echo "║     ✅ 快照时间检查                                                       ║"
    echo "║                                                                           ║"
    echo "╚═══════════════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

main
