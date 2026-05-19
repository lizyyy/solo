const db = require('../db');
const { v4: uuidv4 } = require('uuid');

console.log('开始导入样例数据...');

const now = Date.now();
const minute = 60 * 1000;
const hour = 60 * minute;

const operators = [
  { name: '张护士', role: 'nurse' },
  { name: '李护士', role: 'nurse' },
  { name: '王陪检', role: 'accompanier' },
  { name: '赵陪检', role: 'accompanier' },
  { name: '刘主任', role: 'admin' }
];

const departments = ['内科', '外科', '儿科', '妇产科', '骨科', '眼科'];
const inspectionTypes = ['CT检查', 'MRI检查', 'B超检查', 'X光检查', '采血化验', '心电图'];
const statuses = ['pending', 'accepted', 'in_progress', 'completed', 'cancelled'];

const sampleTasks = [
  {
    patient_name: '张三',
    patient_id: 'P001',
    department: '内科',
    inspection_type: 'CT检查',
    estimated_time: 30,
    status: 'completed',
    assigned_to: '王陪检',
    created_by: '张护士',
    created_at: now - 2 * hour,
    accepted_at: now - 110 * minute,
    started_at: now - 100 * minute,
    completed_at: now - 65 * minute,
    queue_position: 1,
    is_overtime: 0,
    actual_duration: 35
  },
  {
    patient_name: '李四',
    patient_id: 'P002',
    department: '外科',
    inspection_type: 'MRI检查',
    estimated_time: 45,
    status: 'completed',
    assigned_to: '赵陪检',
    created_by: '李护士',
    created_at: now - 3 * hour,
    accepted_at: now - 170 * minute,
    started_at: now - 160 * minute,
    completed_at: now - 95 * minute,
    queue_position: 1,
    is_overtime: 1,
    overtime_reason: '设备临时故障',
    actual_duration: 65
  },
  {
    patient_name: '王五',
    patient_id: 'P003',
    department: '儿科',
    inspection_type: 'B超检查',
    estimated_time: 20,
    status: 'in_progress',
    assigned_to: '王陪检',
    created_by: '张护士',
    created_at: now - 50 * minute,
    accepted_at: now - 40 * minute,
    started_at: now - 30 * minute,
    queue_position: 2,
    is_overtime: 0
  },
  {
    patient_name: '赵六',
    patient_id: 'P004',
    department: '骨科',
    inspection_type: 'X光检查',
    estimated_time: 15,
    status: 'accepted',
    assigned_to: '赵陪检',
    created_by: '李护士',
    created_at: now - 25 * minute,
    accepted_at: now - 20 * minute,
    queue_position: 3,
    is_overtime: 0
  },
  {
    patient_name: '钱七',
    patient_id: 'P005',
    department: '妇产科',
    inspection_type: '采血化验',
    estimated_time: 25,
    status: 'pending',
    created_by: '张护士',
    created_at: now - 10 * minute,
    queue_position: 4,
    is_overtime: 0
  },
  {
    patient_name: '孙八',
    patient_id: 'P006',
    department: '眼科',
    inspection_type: '心电图',
    estimated_time: 10,
    status: 'cancelled',
    created_by: '李护士',
    created_at: now - 4 * hour,
    cancelled_at: now - 3 * hour,
    cancelled_by: '刘主任',
    cancel_reason: '患者临时放弃检查',
    queue_position: 1,
    is_overtime: 0
  }
];

const insertTask = db.prepare(`
  INSERT INTO tasks (
    id, patient_name, patient_id, department, inspection_type,
    estimated_time, status, assigned_to, created_by, created_at,
    accepted_at, started_at, completed_at, cancelled_at, cancelled_by,
    cancel_reason, queue_position, is_overtime, overtime_reason,
    actual_duration, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertAudit = db.prepare(`
  INSERT INTO audit_logs (
    task_id, action, operator, operator_role, old_status, new_status,
    details, error_type, error_message, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const transaction = db.transaction(() => {
  for (const task of sampleTasks) {
    const taskId = uuidv4();
    insertTask.run(
      taskId,
      task.patient_name,
      task.patient_id,
      task.department,
      task.inspection_type,
      task.estimated_time,
      task.status,
      task.assigned_to,
      task.created_by,
      task.created_at,
      task.accepted_at || null,
      task.started_at || null,
      task.completed_at || null,
      task.cancelled_at || null,
      task.cancelled_by || null,
      task.cancel_reason || null,
      task.queue_position,
      task.is_overtime,
      task.overtime_reason || null,
      task.actual_duration || null,
      task.created_at
    );

    insertAudit.run(
      taskId,
      'create',
      task.created_by,
      'nurse',
      null,
      'pending',
      '创建陪检任务',
      null,
      null,
      task.created_at
    );

    if (task.status === 'accepted' || task.status === 'in_progress' || task.status === 'completed') {
      insertAudit.run(
        taskId,
        'accept',
        task.assigned_to,
        'accompanier',
        'pending',
        'accepted',
        '陪检员接单',
        null,
        null,
        task.accepted_at
      );
    }

    if (task.status === 'in_progress' || task.status === 'completed') {
      insertAudit.run(
        taskId,
        'start',
        task.assigned_to,
        'accompanier',
        'accepted',
        'in_progress',
        '开始陪检',
        null,
        null,
        task.started_at
      );
    }

    if (task.status === 'completed') {
      insertAudit.run(
        taskId,
        'complete',
        task.assigned_to,
        'accompanier',
        'in_progress',
        'completed',
        `完成陪检，实际用时${task.actual_duration}分钟`,
        null,
        null,
        task.completed_at
      );

      if (task.is_overtime) {
        insertAudit.run(
          taskId,
          'mark_overtime',
          '系统',
          'system',
          'in_progress',
          'completed',
          task.overtime_reason,
          'OVERTIME',
          '陪检超时',
          task.completed_at
        );
      }
    }

    if (task.status === 'cancelled') {
      insertAudit.run(
        taskId,
        'cancel',
        task.cancelled_by,
        'admin',
        'pending',
        'cancelled',
        task.cancel_reason,
        null,
        null,
        task.cancelled_at
      );
    }
  }
});

transaction();

console.log('样例数据导入完成！');
console.log(`导入了 ${sampleTasks.length} 条任务记录`);
console.log('样例包含：');
console.log('- 2条已完成任务（1条超时）');
console.log('- 1条进行中任务');
console.log('- 1条已接单任务');
console.log('- 1条待接单任务');
console.log('- 1条已取消任务');

process.exit(0);
