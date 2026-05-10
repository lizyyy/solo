const express = require('express');
const cors = require('cors');
const path = require('path');
require('./database');
const consignmentRoutes = require('./routes/consignments');
const inspectionRoutes = require('./routes/inspections');
const historyRoutes = require('./routes/history');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/consignments', consignmentRoutes);
app.use('/api/inspections', inspectionRoutes);
app.use('/api/history', historyRoutes);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

async function start() {
  app.listen(PORT, () => {
    console.log(`二手相机寄卖质检台已启动: http://localhost:${PORT}`);
    console.log('');
    console.log('=== 演示路径说明 ===');
    console.log('');
    console.log('✅ 最短正常演示路径:');
    console.log('  1. 新建寄卖单 -> 填写品牌、型号、客户姓名');
    console.log('  2. 点击"质检"进入工作台');
    console.log('  3. 录入快门数 (状态自动变为"质检中")');
    console.log('  4. 添加瑕疵记录 (如"轻微划痕")');
    console.log('  5. 核对配件 (勾选"机身盖"、"电池"等)');
    console.log('  6. 点击"完成质检"');
    console.log('  7. 填写定价并保存');
    console.log('  8. 点击"上架寄卖"完成流程');
    console.log('  9. 点击"历史"查看所有操作记录');
    console.log('');
    console.log('⚠️ 异常触发路径:');
    console.log('  路径A - 缺少关键质检项:');
    console.log('    1. 新建寄卖单，不录入快门数');
    console.log('    2. 直接点击"完成质检" -> 报错: "请先录入快门数"');
    console.log('');
    console.log('  路径B - 严重瑕疵警告:');
    console.log('    1. 录入快门数后');
    console.log('    2. 添加"严重"等级的瑕疵');
    console.log('    3. 查看"处理建议"区域 -> 显示警告提示');
    console.log('');
    console.log('  路径C - 状态越权操作:');
    console.log('    1. 完成质检 -> 定价 -> 上架');
    console.log('    2. 在"已上架"状态尝试录入快门数');
    console.log('    3. 报错: "当前状态不允许质检"');
    console.log('');
  });
}

start();
