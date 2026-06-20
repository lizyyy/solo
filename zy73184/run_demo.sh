#!/bin/bash
# ============================================================
# 约束规划参数回放 - 一键演示脚本
# ============================================================
# 使用方法：
#   方式1: 直接双击本文件运行
#   方式2: 终端里执行 ./run_demo.sh
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "============================================================"
echo "  约束规划参数回放工具 - 一键演示"
echo "============================================================"
echo ""
echo "📁 数据目录: $SCRIPT_DIR/data/"
echo "📊 示例输入: $SCRIPT_DIR/examples/input_sample.json"
echo "📝 输出目录: $SCRIPT_DIR/output/"
echo ""
echo "------------------------------------------------------------"
echo "  第一步: 查看可用数据"
echo "------------------------------------------------------------"
python -m constraint_param_replay list

echo ""
echo "------------------------------------------------------------"
echo "  第二步: 执行参数回放"
echo "------------------------------------------------------------"
python -m constraint_param_replay replay \
  -i examples/input_sample.json \
  --param-version demo_v1 \
  --sort-reference examples/sort_reference.json

echo ""
echo "------------------------------------------------------------"
echo "  第三步: （可选）记录判断调整"
echo "------------------------------------------------------------"
python -m constraint_param_replay judge \
  --row-id A001 \
  --old 合格 \
  --new 需复核 \
  --reason "演示：小孟复核发现异常，需重新确认" \
  --operator 演示账号

echo ""
echo "------------------------------------------------------------"
echo "  演示完成！"
echo "------------------------------------------------------------"
echo ""
echo "📂 输出文件在 output/ 目录下："
ls -la output/ 2>/dev/null || echo "  (暂无输出文件)"
echo ""
echo "💡 常用命令："
echo "   python -m constraint_param_replay help          查看帮助"
echo "   python -m constraint_param_replay list          查看可用数据"
echo "   python -m constraint_param_replay replay -i 输入文件  执行回放"
echo "   python -m constraint_param_replay judge ...     记录判断调整"
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

read -p "按回车键退出..."
