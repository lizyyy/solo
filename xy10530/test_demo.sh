#!/bin/bash
set -e

cd "$(dirname "$0")"

export MEETING_AI_OPERATOR="演示者"

PY="python3 -m meeting_ai.cli"

echo "=== 初始化数据库..."
rm -rf .meeting-ai

$PY init

echo ""
echo "=== 生成样例纪要..."
$PY generate samples/product.md --type product
$PY generate samples/dev.md --type dev
$PY generate samples/test.md --type test

echo ""
echo "=== 添加参会人和角色..."
$PY people add-role "产品经理" "负责产品规划
$PY people add-role "研发工程师" "负责技术开发"
$PY people add-role "测试工程师" "负责质量保证"
$PY people add-role "架构师" "负责技术架构"
$PY people add-role "运维工程师" "负责运维部署"
$PY people add-role "设计师" "负责UI设计"

$PY people add "张产品" --role "产品经理"
$PY people add "李研发" --role "研发工程师"
$PY people add "王测试" --role "测试工程师"
$PY people add "赵设计" --role "设计师"
$PY people add "王架构" --role "架构师"
$PY people add "陈运维" --role "运维工程师"

echo ""
echo "=== 导入产品会议纪要..."
$PY import-cmd samples/product.md

echo ""
echo "=== 导入研发会议纪要..."
$PY import-cmd samples/dev.md

echo ""
echo "=== 导入测试会议纪要..."
$PY import-cmd samples/test.md

echo ""
echo "=== 检查当前状态..."
$PY check

echo ""
echo "=== 查看报告..."
$PY report

echo ""
echo "=== 演示完成！"
echo ""
echo "你可以继续："
echo "  $PY report --by-assignee   按负责人查看"
echo "  $PY detail 1 --history   查看行动项详情和历史"
echo "  $PY check                 再次检查状态"
echo "  $PY complete 1            标记为完成"
