#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MS="$SCRIPT_DIR/ms"

cd "$SCRIPT_DIR"

echo "========================================"
echo "  物料替代审批 CLI - 失败路径演示"
echo "========================================"
echo ""

echo "[初始化] 重新初始化工作区..."
echo "----------------------------------------"
$MS init --force
$MS import-sample --operator admin
echo ""

echo "========================================"
echo "  失败场景 1: 客户限制"
echo "  (苹果公司 CUST-001 禁止替代 CAP-001)"
echo "========================================"
echo ""
echo "[检查] 尝试为苹果公司的订单替代电容..."
echo "----------------------------------------"
$MS check SMART-TV-001 CAP-001 CAP-002 --customer CUST-001 --quantity 20
echo ""
echo "[尝试创建] 尝试创建申请..."
echo "----------------------------------------"
$MS create --product SMART-TV-001 --component CAP-001 \
    --substitute CAP-002 --customer CUST-001 --quantity 20 \
    --reason "生产缺料" --operator planner
echo ""

echo "========================================"
echo "  失败场景 2: 库存不足"
echo "  (RES-003 只有 200 个，需要 500 个)"
echo "========================================"
echo ""
echo "[检查] 检查高端电阻替代..."
echo "----------------------------------------"
$MS check SMART-TV-001 RES-001 RES-003 --quantity 500
echo ""

echo "========================================"
echo "  失败场景 3: 成本超阈值 - 需二级审批"
echo "  (CAP-001->CAP-003, 成本增加 233% > 30%)"
echo "========================================"
echo ""
echo "[检查] 检查进口电容替代..."
echo "----------------------------------------"
$MS check SMART-TV-001 CAP-001 CAP-003 --quantity 20
echo ""
echo "[创建] 创建申请 (会进入 PENDING_LEVEL1)..."
echo "----------------------------------------"
$MS create --product SMART-TV-001 --component CAP-001 \
    --substitute CAP-003 --quantity 20 \
    --reason "原厂电容缺货，使用进口替代" --operator planner
echo ""
echo "[查看] 申请状态..."
echo "----------------------------------------"
$MS detail APP-000001
echo ""

echo "========================================"
echo "  失败场景 4: 重复申请"
echo "========================================"
echo ""
echo "[创建] 再次创建相同的申请..."
echo "----------------------------------------"
$MS create --product SMART-TV-001 --component CAP-001 \
    --substitute CAP-003 --quantity 20 \
    --reason "生产缺料" --operator planner
echo ""

echo "========================================"
echo "  失败场景 5: 已投料不能撤销"
echo "========================================"
echo ""
echo "[Step 1] 创建一个可以自动审批的申请..."
echo "----------------------------------------"
$MS create --product SMART-TV-001 --component RES-001 \
    --substitute RES-002 --quantity 50 \
    --reason "测试撤销" --operator planner
echo ""
echo "[Step 2] 标记为已投料使用..."
echo "----------------------------------------"
$MS use APP-000002 --operator worker
echo ""
echo "[Step 3] 尝试撤销已投料的申请..."
echo "----------------------------------------"
$MS revoke APP-000002 --operator planner --reason "撤销测试"
echo ""

echo "========================================"
echo "  失败场景 6: 级别不足审批"
echo "  (需要 2 级审批，只用 1 级)"
echo "========================================"
echo ""
echo "[Step 1] 用 1 级审批 APP-000001..."
echo "----------------------------------------"
$MS approve APP-000001 --level 1 --operator "生产经理" --comment "生产需要，同意"
echo ""
echo "[Step 2] 查看状态 (应该还是 PENDING_LEVEL2)..."
echo "----------------------------------------"
$MS detail APP-000001
echo ""
echo "[Step 3] 用 2 级审批通过..."
echo "----------------------------------------"
$MS approve APP-000001 --level 2 --operator "财务经理" --comment "成本在可接受范围内"
echo ""
echo "[Step 4] 再次审批 (幂等性测试)..."
echo "----------------------------------------"
$MS approve APP-000001 --level 2 --operator "财务经理"
echo ""

echo "========================================"
echo "  失败路径演示完成！"
echo "========================================"
echo ""
echo "覆盖的业务规则："
echo "1. 客户限制: 特定客户禁止替代特定物料"
echo "2. 库存检查: 替代料库存不足时不可替代"
echo "3. 成本阈值: >30% 需要二级审批"
echo "4. 重复申请: 相同物料对的活跃申请会被拒绝"
echo "5. 已投料保护: 已使用的申请无法撤销"
echo "6. 幂等性: 重复审批不会重复操作"
