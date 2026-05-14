import { v4 as uuidv4 } from 'uuid';
import moment from 'moment';
import { db, runQuery } from '../database';

const engineers = [
  { id: 'eng001', name: '张三' },
  { id: 'eng002', name: '李四' },
  { id: 'eng003', name: '王五' },
  { id: 'eng004', name: '赵六' },
  { id: 'eng005', name: '钱七' },
];

const shiftTypes = ['morning', 'afternoon', 'night'];
const statuses = ['completed', 'verified', 'pending'];
const riskTypes = ['none', 'low', 'medium', 'high', 'critical'];
const anomalyTypes = ['none', 'system_error', 'merge_conflict', 'data_loss', 'permission_issue'];

function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function seedDutyRecords() {
  console.log('开始生成值班记录...');
  
  const records: any[] = [];
  const startDate = moment().subtract(90, 'days').toDate();
  const endDate = moment().subtract(30, 'days').toDate();

  for (let i = 0; i < 200; i++) {
    const date = randomDate(startDate, endDate);
    const engineer = randomItem(engineers);
    const riskType = randomItem(riskTypes);
    const anomalyType = riskType !== 'none' ? randomItem(anomalyTypes.filter(a => a !== 'none')) : 'none';
    const isDirty = Math.random() < 0.15;
    const mergeError = isDirty && Math.random() < 0.5;

    records.push({
      id: uuidv4(),
      date: moment(date).format('YYYY-MM-DD'),
      engineer_id: engineer.id,
      engineer_name: engineer.name,
      shift_type: randomItem(shiftTypes),
      status: randomItem(statuses),
      risk_type: riskType,
      anomaly_type: anomalyType,
      anomaly_description: anomalyType !== 'none' 
        ? `${anomalyType} occurred during shift` 
        : null,
      merge_error: mergeError ? 1 : 0,
      merged_with: mergeError ? randomItem(engineers).name : null,
      created_at: moment(date).toISOString(),
      updated_at: moment(date).add(1, 'day').toISOString(),
      archived: 0,
      is_dirty: isDirty ? 1 : 0,
      remarks: isDirty ? '系统检测到异常数据' : null,
    });
  }

  for (let i = 0; i < 50; i++) {
    const date = moment().subtract(Math.floor(Math.random() * 30), 'days').toDate();
    const engineer = randomItem(engineers);

    records.push({
      id: uuidv4(),
      date: moment(date).format('YYYY-MM-DD'),
      engineer_id: engineer.id,
      engineer_name: engineer.name,
      shift_type: randomItem(shiftTypes),
      status: randomItem(statuses),
      risk_type: 'none',
      anomaly_type: 'none',
      anomaly_description: null,
      merge_error: 0,
      merged_with: null,
      created_at: moment(date).toISOString(),
      updated_at: moment(date).add(1, 'day').toISOString(),
      archived: 0,
      is_dirty: 0,
      remarks: null,
    });
  }

  for (const record of records) {
    await runQuery(
      `INSERT INTO duty_records (
        id, date, engineer_id, engineer_name, shift_type, status,
        risk_type, anomaly_type, anomaly_description, merge_error,
        merged_with, created_at, updated_at, archived, is_dirty, remarks
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.id, record.date, record.engineer_id, record.engineer_name,
        record.shift_type, record.status, record.risk_type, record.anomaly_type,
        record.anomaly_description, record.merge_error, record.merged_with,
        record.created_at, record.updated_at, record.archived, record.is_dirty,
        record.remarks
      ]
    );
  }

  console.log(`已生成 ${records.length} 条值班记录`);
  console.log(`其中脏数据: ${records.filter((r: any) => r.is_dirty).length} 条`);
  console.log(`合并错误: ${records.filter((r: any) => r.merge_error).length} 条`);
}

async function seedEraseRequests() {
  console.log('生成数据擦除申请...');

  const requests = [
    {
      id: uuidv4(),
      request_no: 'ERASE-2024-001',
      requester_id: 'eng001',
      requester_name: '张三',
      reason: '合规要求，清理超过90天的历史数据',
      status: 'executed',
      record_ids: JSON.stringify([]),
      approved_by: 'admin',
      approved_at: moment().subtract(60, 'days').toISOString(),
      executed_at: moment().subtract(58, 'days').toISOString(),
      created_at: moment().subtract(65, 'days').toISOString(),
      remarks: '已执行归档',
    },
    {
      id: uuidv4(),
      request_no: 'ERASE-2024-002',
      requester_id: 'eng002',
      requester_name: '李四',
      reason: '数据重复，需要合并清理',
      status: 'approved',
      record_ids: JSON.stringify([]),
      approved_by: 'admin',
      approved_at: moment().subtract(30, 'days').toISOString(),
      created_at: moment().subtract(35, 'days').toISOString(),
      remarks: '待执行',
    },
    {
      id: uuidv4(),
      request_no: 'ERASE-2024-003',
      requester_id: 'eng003',
      requester_name: '王五',
      reason: '测试数据清理',
      status: 'pending',
      record_ids: JSON.stringify([]),
      created_at: moment().subtract(5, 'days').toISOString(),
      remarks: '待审批',
    },
  ];

  for (const req of requests) {
    await runQuery(
      `INSERT INTO erase_requests (
        id, request_no, requester_id, requester_name, reason, status,
        record_ids, approved_by, approved_at, executed_at, created_at, remarks
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.id, req.request_no, req.requester_id, req.requester_name,
        req.reason, req.status, req.record_ids, req.approved_by,
        req.approved_at, req.executed_at, req.created_at, req.remarks
      ]
    );
  }

  console.log(`已生成 ${requests.length} 条擦除申请`);
}

function waitForTables(): Promise<void> {
  return new Promise((resolve) => {
    const checkInterval = setInterval(() => {
      db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='duty_records'", (err, row) => {
        if (row) {
          clearInterval(checkInterval);
          resolve();
        }
      });
    }, 100);
  });
}

async function main() {
  try {
    await waitForTables();
    await seedDutyRecords();
    await seedEraseRequests();
    console.log('数据生成完成！');
    db.close();
    process.exit(0);
  } catch (error) {
    console.error('数据生成失败:', error);
    db.close();
    process.exit(1);
  }
}

main();