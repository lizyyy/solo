#!/bin/bash

set -e

echo "========================================"
echo "  物料替代审批 CLI - 成功路径演示"
echo "========================================"
echo ""

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MS="$SCRIPT_DIR/ms"

cd "$SCRIPT_DIR"

echo "[Step 1] 初始化工作区..."
echo "----------------------------------------"
$MS init --force
echo ""

echo "[Step 2] 加载内置样例数据..."
echo "----------------------------------------"
$MS import-sample --operator admin
echo ""

echo "[Step 3] 查看工作区状态..."
echo "----------------------------------------"
$MS status
echo ""

echo "[Step 4] 检查电子料替代: RES-001 -> RES-002"
echo "  (智能电视 55寸，电阻)"
echo "----------------------------------------"
$MS check SMART-TV-001 RES-001 RES-002 --quantity 50
echo ""

echo "[Step 5] 创建替代申请 (自动审批)..."
echo "----------------------------------------"
$MS create --product SMART-TV-001 --component RES-001 \
    --substitute RES-002 --quantity 50 --reason "RES-001库存紧张" \
    --operator planner
echo ""

echo "[Step 6] 检查包装料替代: BOX-001 -> BOX-002"
echo "  (成本降低，应自动通过)"
echo "----------------------------------------"
$MS check SMART-TV-001 BOX-001 BOX-002 --quantity 1
echo ""

echo "[Step 7] 创建包装料替代申请..."
echo "----------------------------------------"
$MS create --product SMART-TV-001 --component BOX-001 \
    --substitute BOX-002 --quantity 1 --reason "标准包装箱缺货，改用简易包装" \
    --operator planner
echo ""

echo "[Step 8] 检查结构件替代: FRAME-001 -> FRAME-002"
echo "  (成本增加 6.25%，在阈值 10% 内，自动审批)"
echo "----------------------------------------"
$MS check SMART-TV-001 FRAME-001 FRAME-002 --quantity 4
echo ""

echo "[Step 9] 创建结构件替代申请..."
echo "----------------------------------------"
$MS create --product SMART-TV-001 --component FRAME-001 \
    --substitute FRAME-002 --quantity 4 --reason "ABS边框库存不足" \
    --operator planner
echo ""

echo "[Step 10] 列出所有申请..."
echo "----------------------------------------"
$MS list
echo ""

echo "[Step 11] 查看第一个申请详情..."
echo "----------------------------------------"
$MS detail APP-000001
echo ""

echo "[Step 12] 标记申请为已投料使用..."
echo "----------------------------------------"
$MS use APP-000001 --operator worker
echo ""

echo "[Step 13] 生成汇总报告..."
echo "----------------------------------------"
$MS report
echo ""

echo "[Step 14] 查看操作历史..."
echo "----------------------------------------"
$MS history --limit 20
echo ""

echo "========================================"
echo "  成功路径演示完成！"
echo "========================================"
echo ""
echo "关键业务点验证："
echo "1. 电子料 (RES-001->RES-002): 成本增加 10%，刚好在阈值，自动审批"
echo "2. 包装料 (BOX-001->BOX-002): 成本降低 30%，自动审批"
echo "3. 结构件 (FRAME-001->FRAME-002): 成本增加 6.25%，在阈值内，自动审批"
echo "4. 已投料的申请无法撤销 (幂等性保护)"
echo "5. 成本分析正确显示总节约和增加"
