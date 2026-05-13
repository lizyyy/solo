#!/bin/bash
# 快速演示脚本

set -e

cd "$(dirname "$0")/.."

export PYTHONPATH="$PWD/src"

echo "=== 快速演示：多租户任务隔离 CLI ==="
echo ""

echo "【1/6】安装依赖..."
python3 -m pip install -q typer rich pydantic

echo ""
echo "【2/6】初始化调度器..."
python3 -m mt_scheduler.cli reset
python3 -m mt_scheduler.cli init

echo ""
echo "【3/6】大租户提交 10 个批量任务..."
for i in $(seq 1 10); do
    python3 -m mt_scheduler.cli submit \
        "batch-a-$i" tenant-a "批量导出-$i" export \
        --priority low --weight 2 > /dev/null 2>&1
done

echo ""
echo "【4/6】小租户提交 3 个实时任务..."
for i in $(seq 1 3); do
    python3 -m mt_scheduler.cli submit \
        "realtime-c-$i" tenant-c "实时查询-$i" query \
        --priority high --weight 1 > /dev/null 2>&1
done

echo ""
echo "【5/6】查看当前状态..."
python3 -m mt_scheduler.cli status

echo ""
echo "【6/6】执行调度，观察顺序..."
python3 -m mt_scheduler.cli run --max-tasks 6 --simulate 50

echo ""
echo "=== 演示完成 ==="
echo "提示：运行 examples/demo_scenario.py 查看完整场景演示"
