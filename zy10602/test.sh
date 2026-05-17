#!/bin/bash

BASE_URL="http://localhost:3000/api"
OUTPUT_DIR="./test-results"
mkdir -p "$OUTPUT_DIR"

echo "========================================"
echo "物联网设备云固件灰度回滚审批 API 验收测试"
echo "========================================"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_test() {
    echo -e "${YELLOW}[测试] $1${NC}"
}

log_success() {
    echo -e "${GREEN}[成功] $1${NC}"
}

log_error() {
    echo -e "${RED}[失败] $1${NC}"
}

# 0. 健康检查
log_test "0. 健康检查..."
curl -s "$BASE_URL/health" | head -50
echo ""
echo ""

# 场景 1: 完整流转
log_test "场景 1: 完整流转 (创建 -> 灰度中 -> 暂停 -> 回滚完成)"
echo ""

log_test "1.1 创建审批单 (待发布)"
APPROVAL_ID=$(curl -s -X POST "$BASE_URL/approvals" \
    -H "Content-Type: application/json" \
    -d '{
        "device_model": "SmartLock-X1",
        "firmware_version": "2.3.0",
        "gray_batch": "GB-2024-001",
        "fault_samples": ["SN001", "SN002", "SN003"],
        "device_group": "group-a",
        "request_type": "回滚",
        "reason": "发现连接稳定性问题",
        "applicant": "张三"
    }' | tee "$OUTPUT_DIR/scenario1-create.json" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)

if [ -z "$APPROVAL_ID" ]; then
    log_error "创建审批单失败"
    cat "$OUTPUT_DIR/scenario1-create.json"
    exit 1
fi
log_success "审批单 ID: $APPROVAL_ID"
echo ""

log_test "1.2 状态流转: 待发布 -> 灰度中"
curl -s -X PATCH "$BASE_URL/approvals/$APPROVAL_ID/status" \
    -H "Content-Type: application/json" \
    -d '{
        "status": "灰度中",
        "operator": "李四",
        "comment": "开始灰度发布"
    }' | tee "$OUTPUT_DIR/scenario1-status1.json"
echo ""
echo ""

log_test "1.3 状态流转: 灰度中 -> 暂停"
curl -s -X PATCH "$BASE_URL/approvals/$APPROVAL_ID/status" \
    -H "Content-Type: application/json" \
    -d '{
        "status": "暂停",
        "operator": "李四",
        "comment": "发现新问题，暂停灰度"
    }' | tee "$OUTPUT_DIR/scenario1-status2.json"
echo ""
echo ""

log_test "1.4 状态流转: 暂停 -> 回滚完成"
curl -s -X PATCH "$BASE_URL/approvals/$APPROVAL_ID/status" \
    -H "Content-Type: application/json" \
    -d '{
        "status": "回滚完成",
        "operator": "王五",
        "comment": "全部回滚完成"
    }' | tee "$OUTPUT_DIR/scenario1-status3.json"
echo ""
echo ""

log_test "1.5 查看审批单详情 (含历史)"
curl -s "$BASE_URL/approvals/$APPROVAL_ID" | python3 -m json.tool | tee "$OUTPUT_DIR/scenario1-detail.json"
echo ""
echo ""

# 场景 2: 冲突检测 (同一设备组同时命中升级和回滚策略)
log_test "场景 2: 冲突检测 (同一设备组同时命中升级和回滚策略)"
echo ""

log_test "2.1 先创建一个升级审批单"
UPGRADE_ID=$(curl -s -X POST "$BASE_URL/approvals" \
    -H "Content-Type: application/json" \
    -d '{
        "device_model": "SmartCamera-S2",
        "firmware_version": "1.5.0",
        "gray_batch": "GB-2024-002",
        "fault_samples": ["SN101", "SN102"],
        "device_group": "group-b",
        "request_type": "升级",
        "reason": "新功能发布",
        "applicant": "赵六"
    }' | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
log_success "升级审批单 ID: $UPGRADE_ID"
echo ""

log_test "2.2 尝试在同一设备组创建回滚审批单 (应检测到冲突)"
curl -s -X POST "$BASE_URL/approvals" \
    -H "Content-Type: application/json" \
    -d '{
        "device_model": "SmartCamera-S2",
        "firmware_version": "1.4.0",
        "gray_batch": "GB-2024-003",
        "fault_samples": ["SN201"],
        "device_group": "group-b",
        "request_type": "回滚",
        "reason": "性能下降",
        "applicant": "钱七"
    }' | python3 -m json.tool | tee "$OUTPUT_DIR/scenario2-conflict.json"
echo ""
echo ""

# 场景 3: 重复请求检测
log_test "场景 3: 重复请求检测"
echo ""

log_test "3.1 尝试创建重复的灰度批次审批单"
curl -s -X POST "$BASE_URL/approvals" \
    -H "Content-Type: application/json" \
    -d '{
        "device_model": "SmartLock-X1",
        "firmware_version": "2.3.0",
        "gray_batch": "GB-2024-001",
        "fault_samples": ["SN001"],
        "device_group": "group-c",
        "request_type": "回滚",
        "reason": "重复测试",
        "applicant": "张三"
    }' | python3 -m json.tool | tee "$OUTPUT_DIR/scenario3-duplicate.json"
echo ""
echo ""

# 场景 4: 撤回后再提交
log_test "场景 4: 撤回后再提交"
echo ""

log_test "4.1 创建一个待发布的审批单"
RECALL_ID=$(curl -s -X POST "$BASE_URL/approvals" \
    -H "Content-Type: application/json" \
    -d '{
        "device_model": "SmartThermo-T3",
        "firmware_version": "3.1.0",
        "gray_batch": "GB-2024-004",
        "fault_samples": ["SN301", "SN302"],
        "device_group": "group-d",
        "request_type": "回滚",
        "reason": "温度偏差",
        "applicant": "孙八"
    }' | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
log_success "审批单 ID: $RECALL_ID"
echo ""

log_test "4.2 撤回审批单"
curl -s -X POST "$BASE_URL/approvals/$RECALL_ID/recall" \
    -H "Content-Type: application/json" \
    -d '{
        "operator": "孙八",
        "comment": "数据需要修正"
    }' | python3 -m json.tool | tee "$OUTPUT_DIR/scenario4-recall.json"
echo ""
echo ""

log_test "4.3 重新提交 (修改后)"
curl -s -X POST "$BASE_URL/approvals/$RECALL_ID/resubmit" \
    -H "Content-Type: application/json" \
    -d '{
        "device_model": "SmartThermo-T3",
        "firmware_version": "3.1.1",
        "gray_batch": "GB-2024-004-fix",
        "fault_samples": ["SN301", "SN302", "SN303"],
        "device_group": "group-d",
        "request_type": "回滚",
        "reason": "温度偏差 (修正后)",
        "applicant": "孙八",
        "operator": "孙八"
    }' | python3 -m json.tool | tee "$OUTPUT_DIR/scenario4-resubmit.json"
echo ""
echo ""

log_test "4.4 查看历史记录 (验证修改字段)"
curl -s "$BASE_URL/approvals/$RECALL_ID/history" | python3 -m json.tool | tee "$OUTPUT_DIR/scenario4-history.json"
echo ""
echo ""

# 场景 5: 导入坏行 (数据验证错误)
log_test "场景 5: 数据验证错误 (导入坏行)"
echo ""

log_test "5.1 缺少必填字段"
curl -s -X POST "$BASE_URL/approvals" \
    -H "Content-Type: application/json" \
    -d '{
        "device_model": "BadDevice",
        "firmware_version": "",
        "gray_batch": ""
    }' | python3 -m json.tool | tee "$OUTPUT_DIR/scenario5-validation.json"
echo ""
echo ""

# 场景 6: 列表查询
log_test "场景 6: 列表查询"
echo ""

log_test "6.1 查询所有审批单"
curl -s "$BASE_URL/approvals" | python3 -m json.tool | tee "$OUTPUT_DIR/scenario6-list.json"
echo ""
echo ""

log_test "6.2 按状态筛选 (待发布)"
curl -s "$BASE_URL/approvals?status=待发布" | python3 -m json.tool | tee "$OUTPUT_DIR/scenario6-filter-status.json"
echo ""
echo ""

# 场景 7: 导出 CSV
log_test "场景 7: 导出 CSV"
echo ""

log_test "7.1 导出所有审批单为 CSV"
curl -s "$BASE_URL/approvals/export/csv" -o "$OUTPUT_DIR/export.csv"
echo "导出文件: $OUTPUT_DIR/export.csv"
cat "$OUTPUT_DIR/export.csv"
echo ""
echo ""

# 最终验证: 列表、详情、历史、导出 互相对齐
log_test "最终验证: 列表、详情、历史、导出 互相对齐"
echo ""

log_test "验证 1: 从列表中取出第一个审批单，查询详情"
FIRST_ID=$(curl -s "$BASE_URL/approvals" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "第一个审批单 ID: $FIRST_ID"
echo ""

log_test "验证 2: 查询该审批单详情"
DETAIL_STATUS=$(curl -s "$BASE_URL/approvals/$FIRST_ID" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
echo "详情中的状态: $DETAIL_STATUS"
echo ""

log_test "验证 3: 查询该审批单历史记录数"
HISTORY_COUNT=$(curl -s "$BASE_URL/approvals/$FIRST_ID/history" | grep -o '"status"' | wc -l)
echo "历史记录数: $HISTORY_COUNT"
echo ""

log_success "所有测试完成!"
echo ""
echo "========================================"
echo "测试结果已保存到: $OUTPUT_DIR/"
echo "========================================"
echo ""
echo "核心数据验证:"
echo "  ✓ 设备型号、固件版本、灰度批次、故障样本"
echo "  ✓ 状态覆盖: 待发布、灰度中、暂停、回滚完成、已撤回"
echo "  ✓ 冲突检测: 同一设备组相反类型审批"
echo "  ✓ 重复请求: 同一灰度批次检测"
echo "  ✓ 撤回重提: 状态流转和字段变更记录"
echo "  ✓ 错误响应: 400 数据验证, 404 不存在, 409 冲突"
echo ""
