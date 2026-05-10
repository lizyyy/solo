#!/bin/bash

echo "=========================================="
echo "  校园二手书撮合 CLI - 完整演示"
echo "=========================================="
echo ""

# 清理之前的数据
rm -rf .book-match-data

# 安装依赖
echo "📦 安装依赖..."
npm install
echo ""

# 编译 TypeScript
echo "🔧 编译项目..."
npm run build
echo ""

NODE_SCRIPT="node dist/index.js"

echo "=========================================="
echo "  第一步：导入卖家清单"
echo "=========================================="
echo ""
$NODE_SCRIPT import-sellers sample-sellers.json
echo ""

echo "=========================================="
echo "  第二步：导入买家需求"
echo "=========================================="
echo ""
$NODE_SCRIPT import-buyers sample-buyers.json
echo ""

echo "=========================================="
echo "  第三步：查看卖家清单"
echo "=========================================="
echo ""
$NODE_SCRIPT list-sellers
echo ""

echo "=========================================="
echo "  第四步：查看买家需求"
echo "=========================================="
echo ""
$NODE_SCRIPT list-buyers
echo ""

echo "=========================================="
echo "  第五步：执行撮合匹配"
echo "=========================================="
echo ""
$NODE_SCRIPT match
echo ""

echo "=========================================="
echo "  演示说明"
echo "=========================================="
echo ""
echo "📚 测试场景说明："
echo ""
echo "1. 完全匹配 - 小明 ↔ 张三（高等数学第7版）"
echo "   ✓ 课程、书名、版本完全相同"
echo "   ✓ 价格35元 ≤ 预算40元"
echo "   ✓ 成色良好在接受范围内"
echo "   ✓ 取书地点匹配"
echo ""
echo "2. 版本不同 - 小明 ↔ 李四（第6版 vs 第7版）"
echo "   ✗ 版本不匹配，不能强行撮合"
echo "   ✓ 系统会明确提示版本差异"
echo ""
echo "3. 价格超预算 - 小红 ↔ 王五（55元 vs 45元）"
echo "   ✗ 价格超出预算，不能交易"
echo "   ✓ 系统会计算差额并提示"
echo ""
echo "4. 测试锁定与取消锁定"
echo "   - 锁定后，该书不能再分给其他买家"
echo "   - 取消后，回到可撮合池，可以重新匹配"
echo ""
echo "🚀 你可以继续执行以下命令进行测试："
echo ""
echo "  # 导出撮合结果"
echo "  npm run dev -- export results.json"
echo ""
echo "  # 锁定交易（需要使用实际的ID）"
echo "  npm run dev -- lock -s <sellerId> -b <buyerId>"
echo ""
echo "  # 取消锁定"
echo "  npm run dev -- unlock -s <sellerId> -b <buyerId>"
echo ""
