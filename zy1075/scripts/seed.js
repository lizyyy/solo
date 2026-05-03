require('dotenv').config();
const models = require('../src/models');
const moment = require('moment');

async function seedDatabase() {
  try {
    console.log('正在填充种子数据...');
    
    await models.sequelize.sync({ force: true });
    console.log('数据库已重置。');
    
    const users = await models.User.bulkCreate([
      {
        name: '张三',
        phone: '13800138001',
        email: 'zhangsan@example.com',
        role: 'admin',
        balance: 500.00,
        status: 'active',
      },
      {
        name: '李四',
        phone: '13800138002',
        email: 'lisi@example.com',
        role: 'user',
        balance: 300.00,
        status: 'active',
      },
      {
        name: '王五',
        phone: '13800138003',
        email: 'wangwu@example.com',
        role: 'user',
        balance: 200.00,
        status: 'active',
      },
      {
        name: '赵六',
        phone: '13800138004',
        email: 'zhaoliu@example.com',
        role: 'user',
        balance: 150.00,
        status: 'active',
      },
      {
        name: '孙七',
        phone: '13800138005',
        email: 'sunqi@example.com',
        role: 'user',
        balance: 100.00,
        status: 'active',
      },
    ]);
    
    console.log(`已创建 ${users.length} 个用户。`);
    
    const items = await models.Item.bulkCreate([
      {
        name: '博世电钻',
        description: '专业级充电式电钻，适用于木材、金属钻孔',
        category: '工具',
        total_quantity: 2,
        available_quantity: 2,
        status: 'available',
        deposit_amount: 200.00,
        overdue_rate: 15.00,
        max_loan_hours: 72,
        notes: '附带各种规格钻头，使用前请检查电量',
      },
      {
        name: '多功能梯子',
        description: '可折叠铝合金梯子，最高3米，承重150kg',
        category: '工具',
        total_quantity: 1,
        available_quantity: 1,
        status: 'available',
        deposit_amount: 100.00,
        overdue_rate: 10.00,
        max_loan_hours: 48,
        notes: '使用时请注意安全，避免超载',
      },
      {
        name: 'EPSON投影仪',
        description: '高清商务投影仪，1080P分辨率，3000流明亮度',
        category: '电子设备',
        total_quantity: 1,
        available_quantity: 1,
        status: 'available',
        deposit_amount: 500.00,
        overdue_rate: 25.00,
        max_loan_hours: 24,
        notes: '附带HDMI线和遥控器，使用前请确认灯泡寿命',
      },
      {
        name: '露营折叠桌',
        description: '便携铝合金折叠桌，展开尺寸120x60cm',
        category: '户外用品',
        total_quantity: 3,
        available_quantity: 3,
        status: 'available',
        deposit_amount: 50.00,
        overdue_rate: 5.00,
        max_loan_hours: 168,
        notes: '适合露营、野餐使用，轻便易携带',
      },
      {
        name: '电动螺丝刀套装',
        description: '多功能电动螺丝刀，附带多种批头',
        category: '工具',
        total_quantity: 2,
        available_quantity: 2,
        status: 'available',
        deposit_amount: 80.00,
        overdue_rate: 8.00,
        max_loan_hours: 72,
        notes: '适合家具组装、电器维修等',
      },
      {
        name: '手推车',
        description: '折叠式手推车，承重100kg，适合搬运重物',
        category: '工具',
        total_quantity: 1,
        available_quantity: 1,
        status: 'maintenance',
        deposit_amount: 150.00,
        overdue_rate: 12.00,
        max_loan_hours: 24,
        notes: '轮子需要维修，暂时不可借',
      },
    ]);
    
    console.log(`已创建 ${items.length} 个物品。`);
    
    const now = moment();
    
    const futureReservation = await models.Reservation.create({
      user_id: users[1].id,
      item_id: items[0].id,
      start_time: now.clone().add(1, 'days').startOf('day').add(9, 'hours').toDate(),
      end_time: now.clone().add(1, 'days').startOf('day').add(17, 'hours').toDate(),
      quantity: 1,
      status: 'confirmed',
      deposit_held: 200.00,
      notes: '用于家里装修钻孔',
    });
    
    console.log('已创建1个未来预约。');
    
    console.log('\n种子数据填充完成！');
    console.log('\n创建的用户：');
    users.forEach(user => {
      console.log(`  - ${user.name} (${user.role}): ${user.id}`);
    });
    
    console.log('\n创建的物品：');
    items.forEach(item => {
      console.log(`  - ${item.name} (${item.status}): ${item.id}, 库存: ${item.available_quantity}/${item.total_quantity}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('种子数据填充失败:', error);
    process.exit(1);
  }
}

seedDatabase();
