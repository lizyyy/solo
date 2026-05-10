const express = require('express');
const cors = require('cors');
const { initDatabase, getData, nextId, now } = require('./database');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3001;

initDatabase();

function seedData() {
  const data = getData();

  data.animal_species = [
    { id: nextId('animal_species'), name: '猫', description: '家猫，Felis catus', created_at: now() },
    { id: nextId('animal_species'), name: '狗', description: '家犬，Canis lupus familiaris', created_at: now() },
    { id: nextId('animal_species'), name: '兔', description: '家兔，Oryctolagus cuniculus', created_at: now() },
    { id: nextId('animal_species'), name: '鸟', description: '观赏鸟', created_at: now() }
  ];

  data.care_levels = [
    { id: nextId('care_levels'), name: '常规护理', frequency_hours: 12, description: '每日两次检查，正常饮食和用药', created_at: now() },
    { id: nextId('care_levels'), name: '加强护理', frequency_hours: 6, description: '每6小时检查一次，密切监控生命体征', created_at: now() },
    { id: nextId('care_levels'), name: '重症监护', frequency_hours: 2, description: '每2小时检查一次，需要持续监控', created_at: now() },
    { id: nextId('care_levels'), name: '隔离护理', frequency_hours: 4, description: '传染病隔离，防护措施执行', created_at: now() }
  ];

  data.cage_locations = [
    { id: nextId('cage_locations'), name: '普通病区A区', description: '一楼左侧普通住院区', created_at: now() },
    { id: nextId('cage_locations'), name: '普通病区B区', description: '一楼右侧普通住院区', created_at: now() },
    { id: nextId('cage_locations'), name: '隔离病区', description: '二楼传染病隔离区', created_at: now() },
    { id: nextId('cage_locations'), name: 'ICU重症区', description: '三楼重症监护室', created_at: now() }
  ];

  data.cages = [
    { id: nextId('cages'), cage_number: 'A-001', location_id: 1, is_isolation: 0, max_weight_kg: 15, status: 'available', notes: '小型犬笼', created_at: now() },
    { id: nextId('cages'), cage_number: 'A-002', location_id: 1, is_isolation: 0, max_weight_kg: 15, status: 'available', notes: '小型犬笼', created_at: now() },
    { id: nextId('cages'), cage_number: 'A-003', location_id: 1, is_isolation: 0, max_weight_kg: 8, status: 'available', notes: '猫笼', created_at: now() },
    { id: nextId('cages'), cage_number: 'A-004', location_id: 1, is_isolation: 0, max_weight_kg: 8, status: 'available', notes: '猫笼', created_at: now() },
    { id: nextId('cages'), cage_number: 'A-005', location_id: 1, is_isolation: 0, max_weight_kg: 30, status: 'available', notes: '大型犬笼', created_at: now() },

    { id: nextId('cages'), cage_number: 'B-001', location_id: 2, is_isolation: 0, max_weight_kg: 8, status: 'available', notes: '猫笼', created_at: now() },
    { id: nextId('cages'), cage_number: 'B-002', location_id: 2, is_isolation: 0, max_weight_kg: 8, status: 'available', notes: '猫笼', created_at: now() },
    { id: nextId('cages'), cage_number: 'B-003', location_id: 2, is_isolation: 0, max_weight_kg: 15, status: 'available', notes: '小型犬笼', created_at: now() },
    { id: nextId('cages'), cage_number: 'B-004', location_id: 2, is_isolation: 0, max_weight_kg: 30, status: 'available', notes: '大型犬笼', created_at: now() },
    { id: nextId('cages'), cage_number: 'B-005', location_id: 2, is_isolation: 0, max_weight_kg: 30, status: 'available', notes: '大型犬笼', created_at: now() },

    { id: nextId('cages'), cage_number: 'ISO-001', location_id: 3, is_isolation: 1, max_weight_kg: 15, status: 'available', notes: '隔离笼-独立通风', created_at: now() },
    { id: nextId('cages'), cage_number: 'ISO-002', location_id: 3, is_isolation: 1, max_weight_kg: 15, status: 'available', notes: '隔离笼-独立通风', created_at: now() },
    { id: nextId('cages'), cage_number: 'ISO-003', location_id: 3, is_isolation: 1, max_weight_kg: 8, status: 'available', notes: '隔离猫笼-负压', created_at: now() },

    { id: nextId('cages'), cage_number: 'ICU-001', location_id: 4, is_isolation: 0, max_weight_kg: 15, status: 'available', notes: '重症监护笼-带氧舱', created_at: now() },
    { id: nextId('cages'), cage_number: 'ICU-002', location_id: 4, is_isolation: 0, max_weight_kg: 30, status: 'available', notes: '重症监护笼-大型', created_at: now() }
  ];

  data.owners = [
    { id: nextId('owners'), name: '张小明', phone: '13800138001', email: 'zhang@example.com', address: '北京市朝阳区', created_at: now() },
    { id: nextId('owners'), name: '李华', phone: '13800138002', email: 'li@example.com', address: '北京市海淀区', created_at: now() },
    { id: nextId('owners'), name: '王芳', phone: '13800138003', email: 'wang@example.com', address: '北京市西城区', created_at: now() },
    { id: nextId('owners'), name: '陈强', phone: '13800138004', email: 'chen@example.com', address: '北京市东城区', created_at: now() }
  ];

  data.pets = [
    { id: nextId('pets'), name: '豆豆', species_id: 2, owner_id: 1, gender: '公', age_years: 3, weight_kg: 8.5, breed: '金毛', microchip: 'CHIP001', notes: '性格温顺，对头孢过敏', created_at: now() },
    { id: nextId('pets'), name: '咪咪', species_id: 1, owner_id: 2, gender: '母', age_years: 2, weight_kg: 4.2, breed: '英短', microchip: 'CHIP002', notes: '室内猫，已绝育', created_at: now() },
    { id: nextId('pets'), name: '旺财', species_id: 2, owner_id: 3, gender: '公', age_years: 5, weight_kg: 25, breed: '拉布拉多', microchip: 'CHIP003', notes: '导盲犬，训练有素', created_at: now() },
    { id: nextId('pets'), name: '小白', species_id: 1, owner_id: 4, gender: '公', age_years: 1, weight_kg: 3.8, breed: '橘猫', microchip: 'CHIP004', notes: '流浪猫救助，尚未绝育', created_at: now() },
    { id: nextId('pets'), name: '花花', species_id: 2, owner_id: 1, gender: '母', age_years: 7, weight_kg: 12, breed: '哈士奇', microchip: 'CHIP005', notes: '老年犬，关节不好', created_at: now() }
  ];

  const currentTime = new Date();
  const twoDaysAgo = new Date(currentTime.getTime() - 2 * 24 * 60 * 60 * 1000);
  const oneDayAgo = new Date(currentTime.getTime() - 1 * 24 * 60 * 60 * 1000);
  const tomorrow = new Date(currentTime.getTime() + 1 * 24 * 60 * 60 * 1000);
  const twoDaysLater = new Date(currentTime.getTime() + 2 * 24 * 60 * 60 * 1000);
  const threeDaysLater = new Date(currentTime.getTime() + 3 * 24 * 60 * 60 * 1000);

  data.hospitalizations = [
    {
      id: nextId('hospitalizations'),
      pet_id: 1,
      cage_id: 2,
      admission_number: 'ADM-2026-001',
      primary_diagnosis: '胃肠炎',
      is_infectious: 0,
      infectious_disease: null,
      care_level_id: 1,
      admission_date: twoDaysAgo.toISOString(),
      expected_discharge_date: twoDaysLater.toISOString(),
      actual_discharge_date: null,
      admission_reason: '呕吐腹泻2天',
      attending_vet: '张医生',
      status: 'active',
      created_at: now(),
      updated_at: now()
    },
    {
      id: nextId('hospitalizations'),
      pet_id: 2,
      cage_id: 11,
      admission_number: 'ADM-2026-002',
      primary_diagnosis: '猫瘟热',
      is_infectious: 1,
      infectious_disease: '猫细小病毒',
      care_level_id: 4,
      admission_date: oneDayAgo.toISOString(),
      expected_discharge_date: threeDaysLater.toISOString(),
      actual_discharge_date: null,
      admission_reason: '发热、食欲废绝',
      attending_vet: '李医生',
      status: 'active',
      created_at: now(),
      updated_at: now()
    },
    {
      id: nextId('hospitalizations'),
      pet_id: 3,
      cage_id: 5,
      admission_number: 'ADM-2026-003',
      primary_diagnosis: '股骨骨折术后',
      is_infectious: 0,
      infectious_disease: null,
      care_level_id: 2,
      admission_date: twoDaysAgo.toISOString(),
      expected_discharge_date: tomorrow.toISOString(),
      actual_discharge_date: null,
      admission_reason: '车祸导致股骨骨折',
      attending_vet: '王医生',
      status: 'active',
      created_at: now(),
      updated_at: now()
    },
    {
      id: nextId('hospitalizations'),
      pet_id: 4,
      cage_id: 6,
      admission_number: 'ADM-2026-004',
      primary_diagnosis: '上呼吸道感染',
      is_infectious: 0,
      infectious_disease: null,
      care_level_id: 1,
      admission_date: oneDayAgo.toISOString(),
      expected_discharge_date: twoDaysLater.toISOString(),
      actual_discharge_date: null,
      admission_reason: '咳嗽流涕',
      attending_vet: '张医生',
      status: 'active',
      created_at: now(),
      updated_at: now()
    },
    {
      id: nextId('hospitalizations'),
      pet_id: 5,
      cage_id: 14,
      admission_number: 'ADM-2026-005',
      primary_diagnosis: '糖尿病酮症酸中毒',
      is_infectious: 0,
      infectious_disease: null,
      care_level_id: 3,
      admission_date: oneDayAgo.toISOString(),
      expected_discharge_date: threeDaysLater.toISOString(),
      actual_discharge_date: null,
      admission_reason: '多饮多尿，精神沉郁',
      attending_vet: '李医生',
      status: 'active',
      created_at: now(),
      updated_at: now()
    }
  ];

  data.cage_history = [
    { id: nextId('cage_history'), hospitalization_id: 1, cage_id: 1, start_date: twoDaysAgo.toISOString(), end_date: oneDayAgo.toISOString(), notes: '初始入院', created_at: now() },
    { id: nextId('cage_history'), hospitalization_id: 1, cage_id: 2, start_date: oneDayAgo.toISOString(), end_date: null, notes: '转笼（已批准）', created_at: now() },
    { id: nextId('cage_history'), hospitalization_id: 2, cage_id: 11, start_date: oneDayAgo.toISOString(), end_date: null, notes: '初始入院', created_at: now() },
    { id: nextId('cage_history'), hospitalization_id: 3, cage_id: 5, start_date: twoDaysAgo.toISOString(), end_date: null, notes: '初始入院', created_at: now() },
    { id: nextId('cage_history'), hospitalization_id: 4, cage_id: 6, start_date: oneDayAgo.toISOString(), end_date: null, notes: '初始入院', created_at: now() },
    { id: nextId('cage_history'), hospitalization_id: 5, cage_id: 14, start_date: oneDayAgo.toISOString(), end_date: null, notes: '初始入院', created_at: now() }
  ];

  data.care_tasks = [
    { id: nextId('care_tasks'), hospitalization_id: 1, task_type: '体温监测', scheduled_time: oneDayAgo.toISOString(), completed_time: oneDayAgo.toISOString(), completed_by: '护士小张', notes: null, status: 'completed', created_at: now() },
    { id: nextId('care_tasks'), hospitalization_id: 1, task_type: '给药：止吐', scheduled_time: oneDayAgo.toISOString(), completed_time: oneDayAgo.toISOString(), completed_by: '护士小张', notes: null, status: 'completed', created_at: now() },
    { id: nextId('care_tasks'), hospitalization_id: 1, task_type: '体温监测', scheduled_time: currentTime.toISOString(), completed_time: null, completed_by: null, notes: null, status: 'pending', created_at: now() },
    { id: nextId('care_tasks'), hospitalization_id: 1, task_type: '输液', scheduled_time: new Date(currentTime.getTime() + 4 * 60 * 60 * 1000).toISOString(), completed_time: null, completed_by: null, notes: null, status: 'pending', created_at: now() },

    { id: nextId('care_tasks'), hospitalization_id: 2, task_type: '体温监测', scheduled_time: oneDayAgo.toISOString(), completed_time: oneDayAgo.toISOString(), completed_by: '护士小李', notes: null, status: 'completed', created_at: now() },
    { id: nextId('care_tasks'), hospitalization_id: 2, task_type: '隔离消毒', scheduled_time: oneDayAgo.toISOString(), completed_time: oneDayAgo.toISOString(), completed_by: '护士小李', notes: null, status: 'completed', created_at: now() },
    { id: nextId('care_tasks'), hospitalization_id: 2, task_type: '体温监测', scheduled_time: currentTime.toISOString(), completed_time: null, completed_by: null, notes: null, status: 'pending', created_at: now() },
    { id: nextId('care_tasks'), hospitalization_id: 2, task_type: '抗病毒治疗', scheduled_time: new Date(currentTime.getTime() + 2 * 60 * 60 * 1000).toISOString(), completed_time: null, completed_by: null, notes: null, status: 'pending', created_at: now() },

    { id: nextId('care_tasks'), hospitalization_id: 3, task_type: '伤口检查', scheduled_time: twoDaysAgo.toISOString(), completed_time: twoDaysAgo.toISOString(), completed_by: '护士小王', notes: null, status: 'completed', created_at: now() },
    { id: nextId('care_tasks'), hospitalization_id: 3, task_type: '给药：止痛', scheduled_time: oneDayAgo.toISOString(), completed_time: oneDayAgo.toISOString(), completed_by: '护士小王', notes: null, status: 'completed', created_at: now() },
    { id: nextId('care_tasks'), hospitalization_id: 3, task_type: '体温监测', scheduled_time: currentTime.toISOString(), completed_time: null, completed_by: null, notes: null, status: 'pending', created_at: now() },
    { id: nextId('care_tasks'), hospitalization_id: 3, task_type: '伤口换药', scheduled_time: new Date(currentTime.getTime() + 6 * 60 * 60 * 1000).toISOString(), completed_time: null, completed_by: null, notes: null, status: 'pending', created_at: now() },
    { id: nextId('care_tasks'), hospitalization_id: 3, task_type: '出院评估', scheduled_time: new Date(currentTime.getTime() + 12 * 60 * 60 * 1000).toISOString(), completed_time: null, completed_by: null, notes: null, status: 'pending', created_at: now() }
  ];

  data.transfer_requests = [
    {
      id: nextId('transfer_requests'),
      hospitalization_id: 1,
      from_cage_id: 1,
      to_cage_id: 2,
      request_reason: '相邻笼位更安静，利于恢复',
      requested_by: '前台小王',
      requested_at: oneDayAgo.toISOString(),
      reviewed_by: '张医生',
      reviewed_at: oneDayAgo.toISOString(),
      status: 'approved',
      rejection_reason: null,
      created_at: now()
    },
    {
      id: nextId('transfer_requests'),
      hospitalization_id: 3,
      from_cage_id: 5,
      to_cage_id: 15,
      request_reason: '术后需要ICU监护',
      requested_by: '王医生',
      requested_at: new Date(currentTime.getTime() - 2 * 60 * 60 * 1000).toISOString(),
      reviewed_by: '李医生',
      reviewed_at: new Date(currentTime.getTime() - 1 * 60 * 60 * 1000).toISOString(),
      status: 'rejected',
      rejection_reason: '大型犬笼空间更充足，利于术后恢复活动',
      created_at: now()
    },
    {
      id: nextId('transfer_requests'),
      hospitalization_id: 4,
      from_cage_id: 6,
      to_cage_id: 7,
      request_reason: '需要更安静的环境',
      requested_by: '前台小李',
      requested_at: now(),
      reviewed_by: null,
      reviewed_at: null,
      status: 'pending',
      rejection_reason: null,
      created_at: now()
    }
  ];

  data.alerts = [
    {
      id: nextId('alerts'),
      hospitalization_id: 2,
      alert_type: 'infectious',
      message: '传染病病例隔离：猫细小病毒',
      severity: 'danger',
      is_resolved: 0,
      resolved_at: null,
      created_at: now()
    },
    {
      id: nextId('alerts'),
      hospitalization_id: 3,
      alert_type: 'medical',
      message: '大型犬骨折术后，需要密切观察',
      severity: 'warning',
      is_resolved: 0,
      resolved_at: null,
      created_at: now()
    }
  ];

  console.log('✅ 样例数据已初始化！');
  console.log('\n📋 初始化数据摘要：');
  console.log('  - 动物种类: 4 种 (猫、狗、兔、鸟)');
  console.log('  - 护理等级: 4 级');
  console.log('  - 笼位区域: 4 个 (普通A区、普通B区、隔离区、ICU)');
  console.log('  - 笼位: 15 个');
  console.log('  - 主人: 4 位');
  console.log('  - 宠物: 5 只');
  console.log('  - 住院病例: 5 例 (含1例传染病隔离)');
  console.log('  - 护理任务: 13 笔 (8待处理，用于测试出院拦截)');
  console.log('  - 转笼申请: 3 笔 (1已批准, 1已驳回, 1待处理)');
  console.log('  - 异常提示: 2 条');
  console.log('\n🔍 测试场景：');
  console.log('  1. 普通住院: ADM-2026-001 豆豆(金毛) 胃肠炎');
  console.log('  2. 传染病隔离: ADM-2026-002 咪咪(英短) 猫瘟热 - 已在隔离笼 ISO-001');
  console.log('  3. 转笼成功: ADM-2026-001 从 A-001 转至 A-002');
  console.log('  4. 转笼驳回: ADM-2026-003 申请转ICU被驳回');
  console.log('  5. 待处理转笼: ADM-2026-004 申请转笼待审批');
  console.log('  6. 出院拦截测试: ADM-2026-003 旺财 有3个待处理护理任务');
}

seedData();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', routes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`\n🐾 宠物医院住院笼位管理系统后端运行在端口 ${PORT}`);
  console.log(`API 基础路径: http://localhost:${PORT}/api`);
  console.log(`健康检查: http://localhost:${PORT}/api/health`);
});
