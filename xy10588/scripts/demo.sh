#!/bin/bash

echo "=== 材料送检批次 CLI 标准演示 ==="

echo ""
echo "0. 安装依赖"
npm install

echo ""
echo "1. 初始化系统"
node src/index.js init --force

echo ""
echo "2. 导入进场批次（钢筋、水泥、防水材料）"
node src/index.js import -t batch -f data/samples/batches.json -o 质检-王

echo ""
echo "3. 检查所有批次状态"
node src/index.js check --all

echo ""
echo "4. 导入取样记录"
node src/index.js import -t sample -f data/samples/samples.json -o 取样员-赵

echo ""
echo "5. 导入检测项目"
node src/index.js import -t test -f data/samples/test-items.json -o 资料员-李

echo ""
echo "6. 检查所有批次状态（变化：已取样→待报告）"
node src/index.js check --all

echo ""
echo "7. 导入检测报告（3份合格报告）"
node src/index.js import -t report -f data/samples/reports.json -o 资料员-李

echo ""
echo "8. 检查所有批次状态（变化：待报告→可使用）"
node src/index.js check --all

echo ""
echo "9. 查看批次 STEEL-2024-001 详情"
node src/index.js detail STEEL-2024-001

echo ""
echo "10. 导入使用记录"
node src/index.js import -t usage -f data/samples/usages.json -o 钢筋班组-王

echo ""
echo "11. 检查所有批次状态"
node src/index.js check --all

echo ""
echo "12. 查看所有报告"
node src/index.js report --list

echo ""
echo "=== 标准演示结束 ==="
echo ""
echo "查看状态说明："
echo "  - 绿色 可使用：检测合格，可正常使用"
echo "  - 黄色 待报告：已送检，等待报告"
echo "  - 红色 已冻结：检测不合格，禁止使用"
echo "  - 红色粗体 违规使用：未检测合格已使用"
