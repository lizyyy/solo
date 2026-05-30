#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "========================================"
echo "  票据贴现利息复算 CLI - 端到端演示"
echo "========================================"
echo ""

cd "$PROJECT_DIR"

echo ">>> 1. 清理旧数据"
rm -f data/store.json
echo "    已清理"
echo ""

echo ">>> 2. 导入到期日历"
npx ts-node src/index.ts import -t calendar -f examples/sample-calendar.csv -s update
echo ""

echo ">>> 3. 导入票据清单"
npx ts-node src/index.ts import -t bills -f examples/sample-bills.csv -s update
echo ""

echo ">>> 4. 导入银行报价"
npx ts-node src/index.ts import -t quotes -f examples/sample-quotes.csv -s update
echo ""

echo ">>> 5. 导入贴现申请"
npx ts-node src/index.ts import -t applications -f examples/sample-applications.csv -s update
echo ""

echo ">>> 6. 导入付款流水"
npx ts-node src/index.ts import -t payments -f examples/sample-payments.csv -s update
echo ""

echo ">>> 7. 查看数据状态"
npx ts-node src/index.ts status
echo ""

echo ">>> 8. 执行贴现利息复算"
npx ts-node src/index.ts calculate
echo ""

echo ">>> 9. 导出复算报告 (CSV)"
npx ts-node src/index.ts report -f csv -o data/reports
echo ""

echo ">>> 10. 导出复算报告 (JSON)"
npx ts-node src/index.ts report -f json -o data/reports
echo ""

echo ">>> 11. 查看异常摘要"
npx ts-node src/index.ts report --anomaly-only
echo ""

echo ">>> 12. 查看状态详情 (含异常)"
npx ts-node src/index.ts status --detail
echo ""

echo ">>> 13. 重复导入测试 (跳过策略)"
npx ts-node src/index.ts import -t bills -f examples/sample-bills.csv -s skip
echo ""

echo ">>> 14. 重复导入测试 (冲突策略)"
npx ts-node src/index.ts import -t bills -f examples/sample-bills.csv -s conflict
echo ""

echo "========================================"
echo "  演示完成！"
echo ""
echo "  常用命令:"
echo "    bdc import  -t <类型> -f <文件> [-s skip|update|conflict]"
echo "    bdc calculate         执行复算"
echo "    bdc report  -f csv|json [-o 目录]"
echo "    bdc status  [-d]      查看状态"
echo "========================================"
