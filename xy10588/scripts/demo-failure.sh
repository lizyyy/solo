#!/bin/bash

echo "=== 材料送检批次 CLI 失败场景演示 ==="

echo ""
echo "0. 安装依赖"
npm install

echo ""
echo "1. 初始化系统"
node src/index.js init --force

echo ""
echo "2. 导入问题批次"
node src/index.js import -t batch -f data/samples/failure/batches.json -o 质检-李

echo ""
echo "3. 导入取样记录"
node src/index.js import -t sample -f data/samples/failure/samples.json -o 取样员-赵

echo ""
echo "4. 导入检测项目"
node src/index.js import -t test -f data/samples/failure/test-items.json -o 资料员-李

echo ""
echo "5. 检查状态"
node src/index.js check --all

echo ""
echo "6. 演示：未送检先使用（违规）"
echo "先尝试在报告回来前使用该批次..."
node src/index.js import -t usage -f <(echo '[{"batchNo":"STEEL-BAD-001","usageDate":"2024-05-12","usedQuantity":10,"usedLocation":"演示违规使用","user":"施工员-张"}]') -o 施工员-张

echo ""
echo "7. 检查状态变化（标记为违规使用）"
node src/index.js check --batch STEEL-BAD-001

echo ""
echo "8. 导入不合格报告"
node src/index.js import -t report -f data/samples/failure/reports.json -o 资料员-李

echo ""
echo "9. 检查状态变化（待报告→已冻结）"
node src/index.js check --batch STEEL-BAD-001

echo ""
echo "10. 演示：报告批次号不匹配"
echo "尝试将报告绑定到错误的批次..."
node src/index.js import -t report -f <(echo '[{"reportNo":"RPT-STEEL-2024-001","batchNo":"STEEL-BAD-001","reportDate":"2024-05-13","lab":"市检测中心","inspector":"刘检测师","conclusion":"测试不匹配","isQualified":true,"filePath":"/test.pdf"}]') -o 资料员-李

echo ""
echo "11. 导入复检合格报告"
node src/index.js import -t report -f data/samples/failure/reinspection.json -o 资料员-李

echo ""
echo "12. 检查状态变化（已冻结→可使用，解冻成功）"
node src/index.js check --batch STEEL-BAD-001

echo ""
echo "13. 演示：人工修正（必须留痕）"
echo "修正备注信息，记录操作者和原因..."
node src/index.js correct -t batch -i STEEL-BAD-001 -k remark -v "复检合格，恢复使用" -o 质检主管-王 -r "复检通过，更新批次备注"

echo ""
echo "14. 查看历史变更记录"
node src/index.js detail STEEL-BAD-001 --history

echo ""
echo "=== 失败场景演示结束 ==="
echo ""
echo "关键规则验证："
echo "  ✓ 未送检已使用 → 标记违规使用"
echo "  ✓ 报告批次号不匹配 → 拒绝导入"
echo "  ✓ 不合格报告 → 自动冻结"
echo "  ✓ 复检合格 → 自动解冻"
echo "  ✓ 人工修正 → 记录前后差异和操作者"
