const { Equipment } = require('../src/models/dal');
const moment = require('moment');

const sampleEquipment = [
  {
    name: 'Canon EOS R5 全画幅相机',
    category: '相机',
    daily_rate: 200,
    deposit_amount: 5000
  },
  {
    name: 'Sony FE 24-70mm F2.8 GM 镜头',
    category: '镜头',
    daily_rate: 150,
    deposit_amount: 3000
  },
  {
    name: 'DJI Mavic 3 无人机',
    category: '无人机',
    daily_rate: 300,
    deposit_amount: 8000
  },
  {
    name: 'Profoto B10 Plus 闪光灯',
    category: '灯光',
    daily_rate: 180,
    deposit_amount: 4000
  },
  {
    name: 'Manfrotto MT055CXPRO3 三脚架',
    category: '配件',
    daily_rate: 50,
    deposit_amount: 800
  }
];

async function initSampleData() {
  console.log('开始初始化样例数据...');
  
  for (const equip of sampleEquipment) {
    const id = await Equipment.create(equip);
    console.log(`已创建设备: ${equip.name} (ID: ${id})`);
  }
  
  console.log('样例数据初始化完成！');
  process.exit(0);
}

initSampleData().catch(err => {
  console.error('初始化失败:', err);
  process.exit(1);
});
