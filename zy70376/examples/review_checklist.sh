#!/bin/bash
# 多租户任务隔离 CLI - 复查用脚本
# 用于验证：边界条件、失败路径、幂等性

set -e

cd "$(dirname "$0")/.."

export PYTHONPATH="$PWD/src"

echo "=============================================="
echo "多租户任务隔离 CLI - 复查检查清单"
echo "=============================================="
echo ""

echo "【步骤 1/7】初始化调度器"
python3 -m mt_scheduler.cli reset
python3 -m mt_scheduler.cli init
echo ""

echo "=============================================="
echo "检查项 1：租户配额边界测试"
echo "=============================================="
echo ""

echo "提交 10 个大租户 A 的任务（配额=4）..."
for i in $(seq 1 10); do
    python3 -m mt_scheduler.cli submit "boundary-a-$i" tenant-a "边界测试-$i" test --priority low > /dev/null
done

echo "提交 3 个小租户 C 的任务（配额=2）..."
for i in $(seq 1 3); do
    python3 -m mt_scheduler.cli submit "boundary-c-$i" tenant-c "小租户任务-$i" test --priority high > /dev/null
done

echo ""
echo "查看当前状态（应看到：大租户有10个等待，小租户有3个等待）"
python3 -m mt_scheduler.cli status
echo ""

read -p "按 Enter 继续执行调度..."

echo ""
echo "执行 6 个任务（应看到：调度顺序轮询各租户）"
python3 -m mt_scheduler.cli run --max-tasks 6 --simulate 30

echo ""
echo "查看调度后状态（大租户运行数应 <= 4，小租户 <= 2）"
python3 -m mt_scheduler.cli status
echo ""

echo "=============================================="
echo "检查项 2：幂等性测试"
echo "=============================================="
echo ""

echo "第一次提交任务（应该成功）"
python3 -m mt_scheduler.cli submit idempotent-001 tenant-b "幂等测试" test

echo ""
echo "第二次提交相同 task_id（应该显示幂等保证）"
python3 -m mt_scheduler.cli submit idempotent-001 tenant-b "幂等测试" test

echo ""
echo "执行任务让它完成"
python3 -m mt_scheduler.cli run --max-tasks 1 --simulate 10

echo ""
echo "第三次提交（应该显示已完成）"
python3 -m mt_scheduler.cli submit idempotent-001 tenant-b "幂等测试" test
echo ""

echo "=============================================="
echo "检查项 3：失败隔离路径测试"
echo "=============================================="
echo ""

echo "提交会失败的任务（retries=1，即总共有2次机会）"
python3 -m mt_scheduler.cli submit failtest-001 tenant-c "失败测试" test --retries 1

echo ""
echo "第一次执行 - 应该失败并重试（retry_count 从 0->1）"
python3 -m mt_scheduler.cli run --max-tasks 1 --tenant-fail tenant-c --simulate 10

echo ""
echo "查看状态 - 任务应仍在 PENDING，retry_count=1"
python3 -m mt_scheduler.cli status

echo ""
echo "第二次执行 - 应该耗尽重试次数（retry_count 从 1->2）"
python3 -m mt_scheduler.cli run --max-tasks 1 --tenant-fail tenant-c --simulate 10

echo ""
echo "查看状态 - 任务应 FAILED，租户 C 配额减少 30%"
python3 -m mt_scheduler.cli status

echo ""
echo "查看失败任务列表"
python3 -m mt_scheduler.cli failures
echo ""

echo "=============================================="
echo "检查项 4：失败隔离验证"
echo "=============================================="
echo ""

echo "提交大租户 A 的新任务"
python3 -m mt_scheduler.cli submit other-a-001 tenant-a "其他租户任务" test

echo ""
echo "执行任务 - 大租户 A 应正常执行，不受租户 C 失败影响"
python3 -m mt_scheduler.cli run --max-tasks 3 --simulate 20

echo ""
echo "查看最终状态"
python3 -m mt_scheduler.cli status

echo ""
echo "=============================================="
echo "检查项 5：再平衡配额测试"
echo "=============================================="
echo ""

echo "让租户 C 有一个成功任务来触发恢复"
python3 -m mt_scheduler.cli submit recover-c-001 tenant-c "恢复测试" test --priority high
python3 -m mt_scheduler.cli run --max-tasks 1 --simulate 20

echo ""
echo "查看状态 - 连续失败应清零，配额减少开始恢复"
python3 -m mt_scheduler.cli status

echo ""
echo "执行再平衡命令"
python3 -m mt_scheduler.cli rebalance
echo ""

echo "=============================================="
echo "检查项 6：生成调度报告"
echo "=============================================="
echo ""

python3 -m mt_scheduler.cli report

echo ""
echo "=============================================="
echo "复查完成！"
echo "=============================================="
echo ""
echo "关键验证点回顾："
echo "1. 大租户配额边界：大租户运行数从不超过 4"
echo "2. 小租户保障：小租户任务也能获得调度"
echo "3. 幂等性：重复提交同一 task_id 不会创建新任务"
echo "4. 失败隔离：租户 C 失败只影响自己的配额"
echo "5. 失败恢复：成功任务和 rebalance 可以恢复配额"
echo ""
