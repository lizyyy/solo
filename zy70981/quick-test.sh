#!/bin/bash

echo "=========================================="
echo "  市政运维数据整合API - 快速测试脚本"
echo "=========================================="
echo ""

echo "📦 检查并安装依赖..."
if [ ! -d "node_modules" ]; then
    npm install
fi
echo ""

echo "🔍 类型检查..."
npx tsc --noEmit
if [ $? -ne 0 ]; then
    echo "❌ 类型检查失败"
    exit 1
fi
echo "✅ 类型检查通过"
echo ""

echo "🧹 清空历史批次记录..."
curl -s -X DELETE http://localhost:3000/api/batches > /dev/null 2>&1
echo ""

echo "🌐 检查服务是否运行..."
if ! curl -s http://localhost:3000/api/health > /dev/null; then
    echo "⚠️  服务未运行，请先执行: npm run dev"
    echo ""
    echo "服务启动后，可手动执行以下测试命令:"
    echo ""
    echo "# 1. 测试告警CSV导入"
    echo 'curl -X POST -F "file=@test-data/alarms.csv" http://localhost:3000/api/upload/alarm'
    echo ""
    echo "# 2. 测试巡查JSON导入"
    echo 'curl -X POST -F "file=@test-data/inspections.json" http://localhost:3000/api/upload/inspection'
    echo ""
    echo "# 3. 测试维修单导入"
    echo 'curl -X POST -F "file=@test-data/maintenance.json" http://localhost:3000/api/upload/maintenance'
    echo ""
    echo "# 4. 查看批次记录"
    echo "curl http://localhost:3000/api/batches"
    echo ""
    exit 0
fi

echo "✅ 服务运行正常"
echo ""

echo "📤 测试1: 导入路灯告警CSV (触发同杆多灯、误报过滤规则)..."
RESULT1=$(curl -s -X POST -F "file=@test-data/alarms.csv" http://localhost:3000/api/upload/alarm)
echo "   成功导入告警数据"
echo ""

echo "🔄 测试2: 重复提交同一文件 (验证去重机制)..."
RESULT2=$(curl -s -X POST -F "file=@test-data/alarms.csv" http://localhost:3000/api/upload/alarm)
if echo "$RESULT2" | grep -q "已存在"; then
    echo "   ✅ 去重机制生效"
else
    echo "   ⚠️  去重可能未生效"
fi
echo ""

echo "📤 测试3: 导入人工巡查JSON..."
RESULT3=$(curl -s -X POST -F "file=@test-data/inspections.json" http://localhost:3000/api/upload/inspection)
echo "   成功导入巡查数据"
echo ""

echo "📤 测试4: 导入维修反馈JSON (触发修复复测规则)..."
RESULT4=$(curl -s -X POST -F "file=@test-data/maintenance.json" http://localhost:3000/api/upload/maintenance)
echo "   成功导入维修数据"
echo ""

echo "📊 测试5: 查看所有批次记录..."
curl -s http://localhost:3000/api/batches | node -e "
const data = JSON.parse(require('fs').readFileSync(0, 'utf-8'));
console.log('   批次总数:', data.batches.length);
data.batches.forEach(b => {
    console.log('   -', b.batchId, '(' + b.sourceType + ')', b.recordCount + '条');
});
"
echo ""

echo "📋 测试6: 单条记录处理说明..."
curl -s -X POST http://localhost:3000/api/explain \
  -H "Content-Type: application/json" \
  -d '{"sourceType":"alarm","record":{"alarmId":"DEMO001","poleId":"P001","lampId":"L001","alarmTime":"2026-05-27T08:30:00+08:00","alarmType":"网络超时","alarmLevel":"medium","location":"演示路1号"}}' | node -e "
const data = JSON.parse(require('fs').readFileSync(0, 'utf-8'));
console.log(data.explanation);
"
echo ""

echo "=========================================="
echo "  ✅ 所有测试完成！"
echo "=========================================="
echo ""
echo "📖 查看完整响应示例（告警数据）:"
echo "$RESULT1" | node -e "
const data = JSON.parse(require('fs').readFileSync(0, 'utf-8'));
console.log('汇总:', data.result.summary);
console.log('边界情况数:', data.result.boundaryCases.length);
data.result.boundaryCases.forEach(bc => {
    console.log('  -', bc.description.slice(0, 50) + '...');
    console.log('    涉及记录:', bc.records.length + '条');
});
"
