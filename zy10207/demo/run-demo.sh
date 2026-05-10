#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DATA_DIR="$PROJECT_DIR/data"
DEMO_DATA_DIR="$SCRIPT_DIR/data"
CLI="node $PROJECT_DIR/src/index.js"

echo ""
echo "========================================"
echo "  🧴 水站桶装水押金对账 CLI 演示"
echo "========================================"
echo ""

echo "📦 步骤 1: 清理旧数据"
echo "----------------------------------------"
rm -rf "$DATA_DIR"
echo "已删除旧数据目录"
echo ""

echo "📥 步骤 2: 导入演示数据"
echo "----------------------------------------"
echo ""
echo "导入历史欠桶..."
$CLI import history "$DEMO_DATA_DIR/history.csv"
echo ""
echo "导入配送单..."
$CLI import delivery "$DEMO_DATA_DIR/delivery.csv"
echo ""
echo "导入回收单..."
$CLI import return "$DEMO_DATA_DIR/return.csv"
echo ""
echo "导入退款申请..."
$CLI import refund "$DEMO_DATA_DIR/refund.csv"
echo ""

echo "🔍 步骤 3: 运行异常检查"
echo "----------------------------------------"
$CLI check
CHECK_RESULT=$?
echo ""

if [ $CHECK_RESULT -eq 0 ]; then
    echo "✅ 步骤 4: 确认入账"
    echo "----------------------------------------"
    $CLI confirm
    echo ""

    echo "📊 步骤 5: 生成对账报表"
    echo "----------------------------------------"
    $CLI report
    echo ""
fi

echo "🔄 步骤 6: 测试重复导入"
echo "----------------------------------------"
echo ""
echo "再次导入相同配送单 (预期失败)..."
$CLI import delivery "$DEMO_DATA_DIR/delivery.csv" || true
echo ""
echo "使用 --skipDuplicateCheck 强制导入 (预期跳过重复)..."
$CLI import delivery "$DEMO_DATA_DIR/delivery.csv" --skipDuplicateCheck
echo ""

echo "❌ 步骤 7: 导入有错误的数据 (展示异常检测)"
echo "----------------------------------------"
$CLI import delivery "$DEMO_DATA_DIR/delivery-with-errors.csv" --skipDuplicateCheck
echo ""
echo "运行异常检查 (应发现错误)..."
$CLI check || true
echo ""

echo "🔧 步骤 8: 人工修正"
echo "----------------------------------------"
echo "查看 staging 中的异常记录..."
echo "💡 示例修正命令:"
echo "   water-deposit fix delivery D20260501111 customer \"新客户名\""
echo "   water-deposit fix delivery D20260501112 bucketCount 5"
echo ""

echo "========================================"
echo "  🎉 演示完成！"
echo "========================================"
echo ""
echo "常用命令汇总:"
echo "  water-deposit import <type> <file>   # 导入数据"
echo "  water-deposit check                  # 异常检查"
echo "  water-deposit fix ...                # 人工修正"
echo "  water-deposit confirm                # 确认入账"
echo "  water-deposit report                 # 生成报表"
echo ""
echo "数据类型:"
echo "  delivery  - 配送单"
echo "  return    - 回收单"
echo "  refund    - 退款申请"
echo "  history   - 历史欠桶"
echo ""
