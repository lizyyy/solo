#!/bin/bash

echo "🚀 开始导入样例数据..."

echo ""
echo "=== 正常数据样例 ==="
echo ""

echo "1. 导入正常疫苗记录（带照片）"
node src/index.js import -t vaccine -n "新冠疫苗" -b "VAC-2024-001" -q 100 -T 5 -H "张药师" -p "/photos/vac001.jpg"

echo ""
echo "2. 导入正常胰岛素记录（带照片）"
node src/index.js import -t insulin -n "甘精胰岛素" -b "INS-2024-001" -q 50 -T 4 -H "李药师" -p "/photos/ins001.jpg"

echo ""
echo "=== 异常数据样例 ==="
echo ""

echo "3. 导入温度越界的疫苗（12℃，超出2-8℃范围）"
node src/index.js import -t vaccine -n "流感疫苗" -b "VAC-2024-002" -q 80 -T 12 -H "王药师" -p "/photos/vac002.jpg"

echo ""
echo "4. 导入缺少照片凭证的胰岛素"
node src/index.js import -t insulin -n "门冬胰岛素" -b "INS-2024-002" -q 30 -T 6 -H "赵药师"

echo ""
echo "5. 导入批号重复（模拟重复入库）"
echo "   先导入第一条..."
node src/index.js import -t vaccine -n "乙肝疫苗" -b "VAC-2024-003" -q 60 -T 3 -H "张药师" -p "/photos/vac003.jpg"

echo ""
echo "   查找第一条记录的ID..."
FIRST_ID=$(ls -la data/records.json && cat data/records.json | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

echo ""
echo "   复核第一条记录，使其生效..."
node src/index.js review -i $FIRST_ID -a

echo ""
echo "   再导入相同批号..."
node src/index.js import -t vaccine -n "乙肝疫苗" -b "VAC-2024-003" -q 60 -T 4 -H "李药师" -p "/photos/vac003-2.jpg"

echo ""
echo "6. 导入有破损说明的记录"
node src/index.js import -t insulin -n "赖脯胰岛素" -b "INS-2024-003" -q 40 -T 5 -H "王药师" -p "/photos/ins003.jpg" -D "外箱轻微挤压，内包装完好"

echo ""
echo "✅ 样例数据导入完成！"
echo ""
echo "💡 接下来可以执行:"
echo "   node src/index.js review -l          # 查看待复核记录"
echo "   node src/index.js query -S           # 查看统计摘要"
echo "   node src/index.js inventory          # 查看库存"
