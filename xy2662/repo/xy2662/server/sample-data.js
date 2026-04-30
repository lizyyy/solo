const db = require('./database');

const sampleOrders = [
  {
    customer_name: '张三',
    phone: '13800138001',
    device_model: 'iPhone 14 Pro',
    fault_description: '屏幕碎裂，无法正常显示',
    quote_amount: 1200,
    repair_parts: '原装屏幕总成',
    expected_pickup_time: '2026-05-03 18:00',
    notes: '客户要求使用原装配件',
    status: 'pending'
  },
  {
    customer_name: '李四',
    phone: '13900139002',
    device_model: '华为 Mate 60',
    fault_description: '电池耗电快，待机时间短',
    quote_amount: 350,
    repair_parts: '原装电池',
    expected_pickup_time: '2026-05-02 16:00',
    notes: '已检测，确认电池健康度只有 65%',
    status: 'quoting'
  },
  {
    customer_name: '王五',
    phone: '13700137003',
    device_model: '小米 14',
    fault_description: '充电口松动，无法正常充电',
    quote_amount: 200,
    repair_parts: '充电尾插',
    expected_pickup_time: '2026-05-02 14:00',
    notes: '正在维修中，需要更换尾插排线',
    status: 'repairing'
  },
  {
    customer_name: '赵六',
    phone: '13600136004',
    device_model: 'OPPO Find X7',
    fault_description: '后置摄像头无法对焦',
    quote_amount: 600,
    repair_parts: '后置摄像头模组',
    expected_pickup_time: '2026-05-01 17:00',
    notes: '维修完成，已测试功能正常',
    status: 'ready'
  },
  {
    customer_name: '孙七',
    phone: '13500135005',
    device_model: 'vivo X100',
    fault_description: '手机进水，无法开机',
    quote_amount: 800,
    repair_parts: '主板维修、清洁处理',
    expected_pickup_time: '2026-04-30 12:00',
    notes: '已完成维修并交付客户',
    status: 'completed'
  },
  {
    customer_name: '周八',
    phone: '13400134006',
    device_model: 'Samsung S24',
    fault_description: '系统卡顿，频繁重启',
    quote_amount: 150,
    repair_parts: '系统重装',
    expected_pickup_time: '2026-05-01 10:00',
    notes: '客户决定买新手机，取消维修',
    status: 'cancelled'
  }
];

async function insertSampleData() {
  try {
    console.log('开始插入示例数据...');

    const existingOrders = await db.all(`SELECT COUNT(*) as count FROM repair_orders`);
    if (existingOrders[0].count > 0) {
      console.log('数据库中已有数据，跳过示例数据插入');
      return false;
    }

    for (const order of sampleOrders) {
      const { status, ...orderData } = order;
      
      const orderId = await db.createRepairOrder(orderData);
      
      if (status !== 'pending') {
        const statusFlow = ['quoting', 'repairing', 'ready', 'completed'];
        const targetIndex = statusFlow.indexOf(status);
        
        if (targetIndex !== -1) {
          for (let i = 0; i <= targetIndex; i++) {
            const nextStatus = statusFlow[i];
            const currentStatus = i === 0 ? 'pending' : statusFlow[i - 1];
            
            if (db.canTransition(currentStatus, nextStatus)) {
              await db.run(`
                UPDATE repair_orders SET status = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
              `, [nextStatus, orderId]);
              
              await db.run(`
                INSERT INTO audit_logs (repair_order_id, action, from_status, to_status, note)
                VALUES (?, 'status_change', ?, ?, ?)
              `, [orderId, currentStatus, nextStatus, `从「${db.getStatusName(currentStatus)}」变更为「${db.getStatusName(nextStatus)}」`]);
            }
          }
        }
        
        if (status === 'cancelled') {
          await db.run(`
            UPDATE repair_orders SET status = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `, ['cancelled', orderId]);
          
          await db.run(`
            INSERT INTO audit_logs (repair_order_id, action, from_status, to_status, note)
            VALUES (?, 'status_change', ?, ?, ?)
          `, [orderId, 'pending', 'cancelled', '从「待检测」变更为「已取消」']);
        }
      }
      
      console.log(`已创建示例工单: ${order.customer_name} - ${order.device_model}`);
    }

    console.log('示例数据插入完成！');
    return true;
  } catch (error) {
    console.error('插入示例数据失败:', error);
    throw error;
  }
}

module.exports = {
  insertSampleData,
  sampleOrders
};
