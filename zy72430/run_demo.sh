#!/bin/bash

echo "============================================================"
echo "  短视频配乐使用回看 - 演示脚本"
echo "============================================================"
echo ""

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI="$BASE_DIR/cli.py"

echo "▶ 运行 1/4: 正常材料"
python3 "$CLI" --mode normal > /tmp/run_normal.log 2>&1
echo "  ✅ 完成，输出已保存到 /tmp/run_normal.log"
echo ""

echo "▶ 运行 2/4: 错口径材料"
python3 "$CLI" --mode wrong-caliber > /tmp/run_wrong.log 2>&1
echo "  ✅ 完成，输出已保存到 /tmp/run_wrong.log"
echo ""

echo "▶ 运行 3/4: 补录材料（重跑）"
python3 "$CLI" --mode supplemented > /tmp/run_supplemented.log 2>&1
echo "  ✅ 完成，输出已保存到 /tmp/run_supplemented.log"
echo ""

echo "▶ 运行 4/4: 完整三步流程演示"
python3 "$CLI" --mode full-workflow > /tmp/run_full.log 2>&1
echo "  ✅ 完成，输出已保存到 /tmp/run_full.log"
echo ""

echo "============================================================"
echo "  所有场景运行完成！"
echo "============================================================"
echo ""
echo "  查看各场景输出："
echo "    正常材料:   cat /tmp/run_normal.log"
echo "    错口径材料:  cat /tmp/run_wrong.log"
echo "    补录材料:    cat /tmp/run_supplemented.log"
echo "    完整流程:    cat /tmp/run_full.log"
echo ""
echo "  也可直接运行："
echo "    python3 $CLI --mode full-workflow"
echo ""
