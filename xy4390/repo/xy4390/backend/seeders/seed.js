const db = require('../database');
const { v4: uuidv4 } = require('uuid');

// 种子数据
const seedData = () => {
  console.log('开始插入种子数据...');
  
  db.serialize(() => {
    // 老人数据
    const elderly = [
      { id: uuidv4(), name: '张大爷', age: 78, room: '101室', phone: '13800138001', emergency_contact: '张大娘 (13800138002)', notes: '高血压、糖尿病患者' },
      { id: uuidv4(), name: '李奶奶', age: 82, room: '102室', phone: '13800138003', emergency_contact: '儿子 (13800138004)', notes: '心脏病患者，需小心看护' },
      { id: uuidv4(), name: '王爷爷', age: 75, room: '103室', phone: '13800138005', emergency_contact: '女儿 (13800138006)', notes: '视力不好，需要协助服药' },
      { id: uuidv4(), name: '赵奶奶', age: 80, room: '201室', phone: '13800138007', emergency_contact: '赵大爷 (13800138008)', notes: '记忆力减退，需反复提醒' },
      { id: uuidv4(), name: '刘爷爷', age: 72, room: '202室', phone: '13800138009', emergency_contact: '儿子 (13800138010)', notes: '轻度中风，行动不便' }
    ];

    // 药品数据
    const medicines = [
      { id: uuidv4(), name: '硝苯地平缓释片', specification: '10mg*30片', manufacturer: '拜耳医药', category: '处方药', description: '用于高血压、冠心病的治疗' },
      { id: uuidv4(), name: '盐酸二甲双胍片', specification: '0.5g*60片', manufacturer: '中美上海施贵宝', category: '处方药', description: '用于2型糖尿病患者' },
      { id: uuidv4(), name: '阿司匹林肠溶片', specification: '100mg*30片', manufacturer: '拜耳医药', category: '处方药', description: '用于预防血栓形成' },
      { id: uuidv4(), name: '复方丹参滴丸', specification: '27mg*180丸', manufacturer: '天士力制药', category: '处方药', description: '用于冠心病、心绞痛' },
      { id: uuidv4(), name: '维生素D滴剂', specification: '400IU*30粒', manufacturer: '青岛双鲸药业', category: '非处方药', description: '补充维生素D，促进钙吸收' },
      { id: uuidv4(), name: '钙片', specification: '600mg*60片', manufacturer: '钙尔奇', category: '保健品', description: '补充钙质，预防骨质疏松' },
      { id: uuidv4(), name: '布洛芬缓释胶囊', specification: '0.3g*20粒', manufacturer: '中美史克', category: '非处方药', description: '用于缓解轻至中度疼痛' },
      { id: uuidv4(), name: '感冒灵颗粒', specification: '10g*9袋', manufacturer: '三九药业', category: '非处方药', description: '用于感冒引起的头痛、发热' }
    ];

    // 插入老人数据
    const insertElderly = db.prepare(`
      INSERT INTO elderly (id, name, age, room, phone, emergency_contact, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    elderly.forEach(e => {
      insertElderly.run(e.id, e.name, e.age, e.room, e.phone, e.emergency_contact, e.notes);
    });
    insertElderly.finalize();
    console.log(`已插入 ${elderly.length} 位老人数据`);

    // 插入药品数据
    const insertMedicine = db.prepare(`
      INSERT INTO medicines (id, name, specification, manufacturer, category, description)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    medicines.forEach(m => {
      insertMedicine.run(m.id, m.name, m.specification, m.manufacturer, m.category, m.description);
    });
    insertMedicine.finalize();
    console.log(`已插入 ${medicines.length} 种药品数据`);

    // 插入库存数据
    const inventory = [
      { id: uuidv4(), medicine_id: medicines[0].id, quantity: 25, threshold: 10, unit: '盒' },
      { id: uuidv4(), medicine_id: medicines[1].id, quantity: 18, threshold: 10, unit: '盒' },
      { id: uuidv4(), medicine_id: medicines[2].id, quantity: 8, threshold: 10, unit: '盒' },
      { id: uuidv4(), medicine_id: medicines[3].id, quantity: 5, threshold: 10, unit: '盒' },
      { id: uuidv4(), medicine_id: medicines[4].id, quantity: 15, threshold: 10, unit: '盒' },
      { id: uuidv4(), medicine_id: medicines[5].id, quantity: 12, threshold: 10, unit: '瓶' },
      { id: uuidv4(), medicine_id: medicines[6].id, quantity: 3, threshold: 5, unit: '盒' },
      { id: uuidv4(), medicine_id: medicines[7].id, quantity: 20, threshold: 10, unit: '盒' }
    ];

    const insertInventory = db.prepare(`
      INSERT INTO inventory (id, medicine_id, quantity, threshold, unit)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    inventory.forEach(i => {
      insertInventory.run(i.id, i.medicine_id, i.quantity, i.threshold, i.unit);
    });
    insertInventory.finalize();
    console.log(`已插入 ${inventory.length} 条库存数据`);

    // 插入服药计划
    const plans = [
      // 张大爷 - 高血压、糖尿病
      { 
        id: uuidv4(), 
        elderly_id: elderly[0].id, 
        medicine_id: medicines[0].id, 
        dosage: '每次1片', 
        time: '08:00', 
        frequency: '每天', 
        status: 'active' 
      },
      { 
        id: uuidv4(), 
        elderly_id: elderly[0].id, 
        medicine_id: medicines[1].id, 
        dosage: '每次1片，随餐服用', 
        time: '07:30', 
        frequency: '每天', 
        status: 'active' 
      },
      { 
        id: uuidv4(), 
        elderly_id: elderly[0].id, 
        medicine_id: medicines[1].id, 
        dosage: '每次1片，随餐服用', 
        time: '12:00', 
        frequency: '每天', 
        status: 'active' 
      },
      { 
        id: uuidv4(), 
        elderly_id: elderly[0].id, 
        medicine_id: medicines[1].id, 
        dosage: '每次1片，随餐服用', 
        time: '18:00', 
        frequency: '每天', 
        status: 'active' 
      },
      // 李奶奶 - 心脏病
      { 
        id: uuidv4(), 
        elderly_id: elderly[1].id, 
        medicine_id: medicines[2].id, 
        dosage: '每次1片', 
        time: '09:00', 
        frequency: '每天', 
        status: 'active' 
      },
      { 
        id: uuidv4(), 
        elderly_id: elderly[1].id, 
        medicine_id: medicines[3].id, 
        dosage: '每次10丸', 
        time: '08:00', 
        frequency: '每天', 
        status: 'active' 
      },
      { 
        id: uuidv4(), 
        elderly_id: elderly[1].id, 
        medicine_id: medicines[3].id, 
        dosage: '每次10丸', 
        time: '16:00', 
        frequency: '每天', 
        status: 'active' 
      },
      // 王爷爷
      { 
        id: uuidv4(), 
        elderly_id: elderly[2].id, 
        medicine_id: medicines[4].id, 
        dosage: '每次1粒', 
        time: '10:00', 
        frequency: '每天', 
        status: 'active' 
      },
      { 
        id: uuidv4(), 
        elderly_id: elderly[2].id, 
        medicine_id: medicines[5].id, 
        dosage: '每次1片', 
        time: '10:00', 
        frequency: '每天', 
        status: 'active' 
      },
      // 赵奶奶
      { 
        id: uuidv4(), 
        elderly_id: elderly[3].id, 
        medicine_id: medicines[0].id, 
        dosage: '每次1片', 
        time: '08:00', 
        frequency: '每天', 
        status: 'active' 
      },
      // 刘爷爷
      { 
        id: uuidv4(), 
        elderly_id: elderly[4].id, 
        medicine_id: medicines[0].id, 
        dosage: '每次1片', 
        time: '09:00', 
        frequency: '每天', 
        status: 'active' 
      },
      { 
        id: uuidv4(), 
        elderly_id: elderly[4].id, 
        medicine_id: medicines[6].id, 
        dosage: '每次1粒，疼痛时服用', 
        time: '14:00', 
        frequency: '每天', 
        status: 'inactive',
        notes: '备用止痛药，疼痛时才服用'
      }
    ];

    const insertPlan = db.prepare(`
      INSERT INTO medication_plans (id, elderly_id, medicine_id, dosage, time, frequency, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    plans.forEach(p => {
      insertPlan.run(p.id, p.elderly_id, p.medicine_id, p.dosage, p.time, p.frequency, p.status, p.notes || null);
    });
    insertPlan.finalize();
    console.log(`已插入 ${plans.length} 条服药计划`);

    // 插入一些历史提醒记录（过去7天的）
    const today = new Date();
    const reminderRecords = [];
    
    // 生成过去7天的一些历史记录
    for (let i = 1; i <= 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      // 张大爷的记录
      reminderRecords.push({
        id: uuidv4(),
        plan_id: plans[0].id,
        elderly_id: elderly[0].id,
        medicine_id: medicines[0].id,
        scheduled_time: `${dateStr}T08:00:00`,
        actual_time: `${dateStr}T08:05:00`,
        status: Math.random() > 0.2 ? 'reminded' : 'missed',
        volunteer_name: ['王志愿者', '李志愿者', '张志愿者', '刘志愿者'][Math.floor(Math.random() * 4)],
        notes: null
      });
      
      reminderRecords.push({
        id: uuidv4(),
        plan_id: plans[1].id,
        elderly_id: elderly[0].id,
        medicine_id: medicines[1].id,
        scheduled_time: `${dateStr}T07:30:00`,
        actual_time: `${dateStr}T07:32:00`,
        status: 'reminded',
        volunteer_name: ['王志愿者', '李志愿者', '张志愿者', '刘志愿者'][Math.floor(Math.random() * 4)],
        notes: null
      });
      
      // 李奶奶的记录
      reminderRecords.push({
        id: uuidv4(),
        plan_id: plans[4].id,
        elderly_id: elderly[1].id,
        medicine_id: medicines[2].id,
        scheduled_time: `${dateStr}T09:00:00`,
        actual_time: `${dateStr}T09:10:00`,
        status: Math.random() > 0.3 ? 'reminded' : 'missed',
        volunteer_name: ['王志愿者', '李志愿者', '张志愿者', '刘志愿者'][Math.floor(Math.random() * 4)],
        notes: null
      });
    }
    
    if (reminderRecords.length > 0) {
      const insertReminder = db.prepare(`
        INSERT INTO reminder_records (id, plan_id, elderly_id, medicine_id, scheduled_time, actual_time, status, volunteer_name, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      reminderRecords.forEach(r => {
        insertReminder.run(r.id, r.plan_id, r.elderly_id, r.medicine_id, r.scheduled_time, r.actual_time, r.status, r.volunteer_name, r.notes);
      });
      insertReminder.finalize();
      console.log(`已插入 ${reminderRecords.length} 条历史提醒记录`);
    }

    // 插入一些交接记录
    const handoverRecords = [
      {
        id: uuidv4(),
        medicine_id: medicines[0].id,
        from_volunteer: '王志愿者',
        to_volunteer: '李志愿者',
        quantity: 10,
        notes: '早班交接'
      },
      {
        id: uuidv4(),
        medicine_id: medicines[1].id,
        from_volunteer: '李志愿者',
        to_volunteer: '张志愿者',
        quantity: 8,
        notes: '中班交接'
      },
      {
        id: uuidv4(),
        medicine_id: medicines[2].id,
        from_volunteer: '张志愿者',
        to_volunteer: '刘志愿者',
        quantity: 5,
        notes: '晚班交接，库存不足'
      }
    ];

    const insertHandover = db.prepare(`
      INSERT INTO handover_records (id, medicine_id, from_volunteer, to_volunteer, quantity, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    handoverRecords.forEach(h => {
      insertHandover.run(h.id, h.medicine_id, h.from_volunteer, h.to_volunteer, h.quantity, h.notes);
    });
    insertHandover.finalize();
    console.log(`已插入 ${handoverRecords.length} 条交接记录`);

    // 插入补药任务
    const replenishTasks = [
      {
        id: uuidv4(),
        medicine_id: medicines[2].id,
        current_quantity: 8,
        required_quantity: 20,
        status: 'pending',
        assigned_to: '王志愿者',
        notes: '库存低至8盒，阈值为10'
      },
      {
        id: uuidv4(),
        medicine_id: medicines[3].id,
        current_quantity: 5,
        required_quantity: 20,
        status: 'pending',
        assigned_to: '李志愿者',
        notes: '库存低至5盒，阈值为10'
      },
      {
        id: uuidv4(),
        medicine_id: medicines[6].id,
        current_quantity: 3,
        required_quantity: 10,
        status: 'completed',
        assigned_to: '张志愿者',
        notes: '已完成补药',
        completed_at: new Date(today.setDate(today.getDate() - 2)).toISOString()
      }
    ];

    const insertReplenish = db.prepare(`
      INSERT INTO replenish_tasks (id, medicine_id, current_quantity, required_quantity, status, assigned_to, notes, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    replenishTasks.forEach(t => {
      insertReplenish.run(t.id, t.medicine_id, t.current_quantity, t.required_quantity, t.status, t.assigned_to, t.notes, t.completed_at || null);
    });
    insertReplenish.finalize();
    console.log(`已插入 ${replenishTasks.length} 条补药任务`);

    console.log('\n种子数据插入完成！');
    console.log('\n数据概览：');
    console.log(`- 老人: ${elderly.length} 位`);
    console.log(`- 药品: ${medicines.length} 种`);
    console.log(`- 服药计划: ${plans.length} 条`);
    console.log(`- 库存记录: ${inventory.length} 条`);
    console.log(`- 历史提醒: ${reminderRecords.length} 条`);
    console.log(`- 交接记录: ${handoverRecords.length} 条`);
    console.log(`- 补药任务: ${replenishTasks.length} 条`);
    
    // 关闭数据库
    db.close((err) => {
      if (err) {
        console.error('关闭数据库时出错:', err.message);
      } else {
        console.log('\n数据库连接已关闭');
      }
    });
  });
};

// 运行种子数据
seedData();
