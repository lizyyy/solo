#!/bin/bash
set -e

DATA_DIR="./demo_data/runtime"

echo "========================================"
echo "约束满足宿舍分配 - 步骤回放脚本"
echo "给新人讲流程时一步步执行"
echo "========================================"

echo ""
echo "【第一步】查看当前所有运行记录"
echo "----------------------------------------"
python3 -m dorm_allocator.cli --data-dir $DATA_DIR list-runs

echo ""
read -p "按回车继续..."

echo ""
echo "【第二步】查看第一次导入（无批注的原始状态）"
echo "----------------------------------------"
RUN1=$(python3 -m dorm_allocator.cli --data-dir $DATA_DIR list-runs 2>&1 | grep import_screenshot | head -1 | awk '{print $2}')
if [ -n "$RUN1" ]; then
    python3 -m dorm_allocator.cli --data-dir $DATA_DIR demo --run-id $RUN1
else
    echo "请先运行 python3 run_demo.py 生成演示数据"
    exit 1
fi

echo ""
read -p "按回车继续..."

echo ""
echo "【第三步】查看带批注的重跑结果（完整流程）"
echo "----------------------------------------"
RUN2=$(python3 -m dorm_allocator.cli --data-dir $DATA_DIR list-runs 2>&1 | grep rerun | head -1 | awk '{print $2}')
if [ -n "$RUN2" ]; then
    python3 -m dorm_allocator.cli --data-dir $DATA_DIR demo --run-id $RUN2
else
    echo "未找到重跑记录"
fi

echo ""
read -p "按回车继续..."

echo ""
echo "【第四步】生成复盘报告（给吴老师存档用）"
echo "----------------------------------------"
python3 -m dorm_allocator.cli --data-dir $DATA_DIR report $RUN2

echo ""
echo "【第五步】生成HTML小看板"
echo "----------------------------------------"
python3 -m dorm_allocator.dashboard --data-dir $DATA_DIR --output replay_dashboard.html
echo "看板已生成: replay_dashboard.html"

echo ""
echo "========================================"
echo "回放完成！"
echo "========================================"
echo ""
echo "吴老师给新人讲解要点："
echo "1. 分母为0为什么不自动修正？ - 因为要保留原始截图状态"
echo "2. 批注补录后什么变了？ - 状态说明、为何保留、下一步都更新了"
echo "3. 修正记录在哪里？ - 在批注里，完整追溯"
echo "4. 最终的课堂演示结果不是冰冷的数字，而是有故事的"
