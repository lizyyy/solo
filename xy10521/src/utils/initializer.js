const { storage, generateId, save } = require('./storage');

async function initializeData() {
  if (Object.keys(storage.equipment).length > 0) {
    console.log('数据已存在，跳过初始化');
    return;
  }
  
  const sampleEquipments = [
    {
      equipmentId: generateId('EQ'),
      name: '专业单反相机',
      model: 'Canon EOS R5',
      category: '相机',
      depositAmount: 15000,
      dailyRentalFee: 200,
      overdueDailyRate: 1.5,
      status: 'AVAILABLE',
      createdAt: new Date().toISOString(),
      createdBy: 'system'
    },
    {
      equipmentId: generateId('EQ'),
      name: '专业镜头',
      model: 'RF 24-70mm F2.8',
      category: '镜头',
      depositAmount: 8000,
      dailyRentalFee: 80,
      overdueDailyRate: 1.5,
      status: 'AVAILABLE',
      createdAt: new Date().toISOString(),
      createdBy: 'system'
    },
    {
      equipmentId: generateId('EQ'),
      name: '专业三脚架',
      model: 'Gitzo GT3543LS',
      category: '配件',
      depositAmount: 3000,
      dailyRentalFee: 30,
      overdueDailyRate: 1.5,
      status: 'AVAILABLE',
      createdAt: new Date().toISOString(),
      createdBy: 'system'
    }
  ];
  
  sampleEquipments.forEach(eq => {
    storage.equipment[eq.equipmentId] = eq;
    storage.statusHistory[eq.equipmentId] = [];
  });
  
  await save();
  console.log('初始化完成，已创建 3 个示例设备');
}

module.exports = {
  initializeData
};