#!/bin/bash

# 烘焙中央厨房配方批次 CLI 演示脚本
# 运行：bash run-demo.sh

set -e

cd "$(dirname "$0")"

echo "========================================"
echo "  烘焙中央厨房配方批次 CLI 演示"
echo "========================================"
echo ""

# 1. 初始化
echo "[步骤 1] 初始化数据目录..."
node index.js init
echo ""

# 2. 导入配方
echo "[步骤 2] 导入配方数据..."
node index.js import recipes ./examples/recipes.json
echo ""

# 3. 导入库存
echo "[步骤 3] 导入库存数据..."
node index.js import inventory ./examples/inventory.json
echo ""

# 4. 导入替代规则
echo "[步骤 4] 导入替代规则..."
node index.js import substitutes ./examples/substitutes.json
echo ""

# 5. 导入历史损耗
echo "[步骤 5] 导入历史损耗记录..."
node index.js import losses ./examples/losses.json
echo ""

# 6. 导入订单
echo "[步骤 6] 导入门店订单..."
node index.js import orders ./examples/orders.json
echo ""

# 7. 校验生成生产单
echo "[步骤 7] 校验数据，生成生产单预览..."
node index.js validate
echo ""

# 8. 导出生产单
echo "[步骤 8] 导出生产单到 output 目录..."
mkdir -p ./output
node index.js export production ./output/production-preview.json
echo ""

# 9. 测试重复导入（应该报错）
echo "[步骤 9] 测试重复导入保护（预期报错）..."
echo "  尝试再次导入相同的订单数据..."
node index.js import orders ./examples/orders.json 2>&1 || echo "  ✓ 正确阻止了重复导入"
echo ""

# 10. 查询库存
echo "[步骤 10] 查询当前库存状态..."
node index.js query inventory
echo ""

# 11. 查询订单
echo "[步骤 11] 查询订单状态..."
node index.js query orders
echo ""

echo "========================================"
echo "  演示完成！"
echo "========================================"
echo ""
echo "可执行的后续操作："
echo "  确认生产批次: node index.js confirm <批次号>"
echo "  查看批次历史: node index.js query batches"
echo "  导出批次数据: node index.js export batches ./output/batches.json"
echo ""
