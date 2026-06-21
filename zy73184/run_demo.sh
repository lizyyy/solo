#!/bin/bash
# ============================================================
# 约束规划参数回放 - 一键演示脚本
# ============================================================
# 使用方法：
#   方式1: 终端里执行 ./run_demo.sh
#   方式2: 双击本文件运行（需要可执行权限）
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# 检测 python 命令
if command -v python3 &> /dev/null; then
    PY_CMD="python3"
elif command -v python &> /dev/null; then
    PY_CMD="python"
else
    echo "❌ 未找到 Python，请先安装 Python 3"
    exit 1
fi

echo "============================================================"
echo "  约束规划参数回放工具 - 一键演示"
echo "============================================================"
echo ""
echo "📁 数据目录: $SCRIPT_DIR/data/"
echo "📊 示例输入: $SCRIPT_DIR/examples/input_sample.json"
echo "📝 输出目录: $SCRIPT_DIR/output/"
echo ""

echo "------------------------------------------------------------"
echo "  演示 1: 基础回放（带排序检测和来源追踪）"
echo "------------------------------------------------------------"
$PY_CMD -m constraint_param_replay replay \
  -i examples/input_sample.json \
  --param-version demo_v1 \
  --sort-reference examples/sort_reference.json

echo ""
echo "------------------------------------------------------------"
echo "  演示 2: 单位换算（全部换算为万元）"
echo "------------------------------------------------------------"
$PY_CMD -m constraint_param_replay replay \
  -i examples/input_sample.json \
  --param-version demo_v1_wan \
  --target-unit 万元 \
  2>&1 | head -30

echo "  ...（省略输出，完整报告见 output/ 目录）"

echo ""
echo "------------------------------------------------------------"
echo "  演示 3: 记录判断调整"
echo "------------------------------------------------------------"
$PY_CMD -m constraint_param_replay judge \
  --row-id A003 \
  --old 合格 \
  --new 需复核 \
  --reason "演示：晚到附件更新了数值，需重新确认" \
  --operator 演示账号

echo ""
echo "------------------------------------------------------------"
echo "  演示完成！"
echo "------------------------------------------------------------"
echo ""
echo "📂 输出文件在 output/ 目录下："
ls -la output/*.txt output/*.json 2>/dev/null | tail -6 || echo "  (暂无输出文件)"
echo ""
echo "📊 关键验证点："
echo "   ✅ 受晚到附件影响: 3 行（A003、A006、B001）"
echo "   ✅ 受口头备注影响: 2 行（A005 改判断、A006 仅说明）"
echo "   ✅ 受旧版答案影响: 2 行（A002、B001）"
echo "   ✅ 排序不稳定: 1 行（A003，单独拎出）"
echo "   ✅ 坏行: 2 行、跳过行: 2 行（单独统计）"
echo ""
echo "💡 常用命令："
echo "   $PY_CMD -m constraint_param_replay help                    查看帮助"
echo "   $PY_CMD -m constraint_param_replay list                    查看判断调整记录"
echo "   $PY_CMD -m constraint_param_replay replay -i 输入文件       执行回放"
echo "   $PY_CMD -m constraint_param_replay judge ...               记录判断调整"
echo ""
echo "📖 材料都在哪："
echo "   data/formulas/          公式定义"
echo "   data/history/           历史答案（最新版+旧版）"
echo "   data/attachments/       晚到附件"
echo "   data/notes/             口头备注"
echo "   data/unit_conversions.json  单位换算规则"
echo "   examples/               示例输入文件"
echo "   output/                 回放报告输出"
echo ""
echo "📚 详细说明见 README.md"
echo ""
