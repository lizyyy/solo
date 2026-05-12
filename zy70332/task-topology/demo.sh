#!/usr/bin/env bash

set -e

cd "$(dirname "$0")"

echo "=========================================="
echo "  任务依赖拓扑 CLI - 完整演示流程"
echo "=========================================="
echo ""

run_date="2026-05-12"
storage_dir="./storage_data"
CLI_CMD="python3 __main__.py"

echo "[准备] 清理历史数据..."
rm -rf "$storage_dir"
echo ""

echo "──────────────────────────────────────────"
echo "  步骤 1: 查看任务依赖拓扑"
echo "──────────────────────────────────────────"
echo ""
$CLI_CMD graph
echo ""

read -p "按回车继续..."
echo ""

echo "──────────────────────────────────────────"
echo "  步骤 2: 导入失败状态（订单同步失败场景）"
echo "──────────────────────────────────────────"
echo ""
$CLI_CMD import --date "$run_date" --file samples/state_1_failed.yaml
echo ""

read -p "按回车继续..."
echo ""

echo "──────────────────────────────────────────"
echo "  步骤 3: 查看运行状态报告"
echo "──────────────────────────────────────────"
echo ""
$CLI_CMD report --date "$run_date"
echo ""

read -p "按回车继续..."
echo ""

echo "──────────────────────────────────────────"
echo "  步骤 4: 分析失败影响"
echo "──────────────────────────────────────────"
echo ""
$CLI_CMD impact --date "$run_date"
echo ""

read -p "按回车继续..."
echo ""

echo "──────────────────────────────────────────"
echo "  步骤 5: 生成重跑计划"
echo "──────────────────────────────────────────"
echo ""
$CLI_CMD plan --date "$run_date"
echo ""

read -p "按回车继续..."
echo ""

echo "──────────────────────────────────────────"
echo "  步骤 6: 手工跳过一个任务"
echo "  (假设 order_detail_report 今天不需要)"
echo "──────────────────────────────────────────"
echo ""
$CLI_CMD skip --date "$run_date" --task order_detail_report \
    --reason "运营同事确认今天不需要订单明细报表，已通知数据产品"
echo ""

read -p "按回车继续..."
echo ""

echo "──────────────────────────────────────────"
echo "  步骤 7: 再次查看重跑计划"
echo "  (注意已跳过的任务和原因)"
echo "──────────────────────────────────────────"
echo ""
$CLI_CMD plan --date "$run_date"
echo ""

read -p "按回车继续..."
echo ""

echo "──────────────────────────────────────────"
echo "  步骤 8: 重复导入相同状态（验证去重）"
echo "──────────────────────────────────────────"
echo ""
$CLI_CMD import --date "$run_date" --file samples/state_1_failed.yaml
echo ""

read -p "按回车继续..."
echo ""

echo "──────────────────────────────────────────"
echo "  步骤 9: 标记 order_raw_sync 已修复"
echo "  (上游问题已解决)"
echo "──────────────────────────────────────────"
echo ""
$CLI_CMD mark-fixed --date "$run_date" --task order_raw_sync \
    --reason "订单系统 API 已恢复，网络工程师确认"
echo ""

read -p "按回车继续..."
echo ""

echo "──────────────────────────────────────────"
echo "  步骤 10: 导入修复后的状态"
echo "  (模拟重跑成功)"
echo "──────────────────────────────────────────"
echo ""
$CLI_CMD import --date "$run_date" --file samples/state_2_fixed.yaml
echo ""

read -p "按回车继续..."
echo ""

echo "──────────────────────────────────────────"
echo "  步骤 11: 查看最终状态报告"
echo "  (注意手工跳过的任务保留不变)"
echo "──────────────────────────────────────────"
echo ""
$CLI_CMD report --date "$run_date"
echo ""

echo "=========================================="
echo "  演示完成！"
echo "=========================================="
echo ""
echo "关键特性总结:"
echo "  1. 依赖图分析 - 显示任务拓扑和可能的环"
echo "  2. 导入去重 - 相同状态不会重复生成失败记录"
echo "  3. 影响分析 - 定位受影响的下游任务"
echo "  4. 重跑计划 - 区分技术可重跑和业务建议重跑"
echo "  5. 手工跳过 - 需要原因，且不会被后续导入覆盖"
echo "  6. 上游修复 - 下游状态自动更新"
echo ""
