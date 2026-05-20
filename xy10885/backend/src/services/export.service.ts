import { createObjectCsvWriter } from 'csv-writer';
import { allQuery } from '../database';
import { tmpdir } from 'os';
import { join } from 'path';

export async function exportSlotsToCsv() {
  const slots = await allQuery('SELECT * FROM department_slots ORDER BY date DESC, time_slot ASC');
  const filePath = join(tmpdir(), `slots-export-${Date.now()}.csv`);
  
  const csvWriter = createObjectCsvWriter({
    path: filePath,
    header: [
      { id: 'id', title: 'ID' },
      { id: 'department_id', title: '科室ID' },
      { id: 'department_name', title: '科室名称' },
      { id: 'external_system_id', title: '外部系统ID' },
      { id: 'date', title: '日期' },
      { id: 'time_slot', title: '时段' },
      { id: 'total_count', title: '总号数' },
      { id: 'available_count', title: '可用号数' },
      { id: 'locked_count', title: '已锁号数' },
      { id: 'status', title: '状态' },
      { id: 'created_at', title: '创建时间' }
    ]
  });
  
  await csvWriter.writeRecords(slots);
  return filePath;
}

export async function exportVouchersToCsv(params?: { status?: string }) {
  let sql = 'SELECT * FROM appointment_vouchers';
  const queryParams: any[] = [];
  
  if (params?.status) {
    sql += ' WHERE status = ?';
    queryParams.push(params.status);
  }
  sql += ' ORDER BY created_at DESC';
  
  const vouchers = await allQuery(sql, queryParams);
  const filePath = join(tmpdir(), `vouchers-export-${Date.now()}.csv`);
  
  const csvWriter = createObjectCsvWriter({
    path: filePath,
    header: [
      { id: 'id', title: 'ID' },
      { id: 'voucher_code', title: '凭证号' },
      { id: 'patient_id', title: '患者ID' },
      { id: 'patient_name', title: '患者姓名' },
      { id: 'slot_id', title: '号源ID' },
      { id: 'status', title: '状态' },
      { id: 'check_in_time', title: '签到时间' },
      { id: 'cancel_time', title: '取消时间' },
      { id: 'created_at', title: '创建时间' }
    ]
  });
  
  await csvWriter.writeRecords(vouchers);
  return filePath;
}

export async function exportStatisticsToCsv() {
  const slotStats = await allQuery(`
    SELECT 
      date,
      department_name,
      COUNT(*) as slot_count,
      SUM(total_count) as total_count,
      SUM(available_count) as available_count,
      SUM(locked_count) as locked_count
    FROM department_slots
    GROUP BY date, department_name
    ORDER BY date DESC
  `);
  
  const voucherStats = await allQuery(`
    SELECT 
      status,
      COUNT(*) as count
    FROM appointment_vouchers
    GROUP BY status
  `);
  
  const conflictStats = await allQuery(`
    SELECT 
      conflict_type,
      status,
      COUNT(*) as count
    FROM conflict_records
    GROUP BY conflict_type, status
  `);
  
  const filePath = join(tmpdir(), `statistics-export-${Date.now()}.csv`);
  
  const csvWriter = createObjectCsvWriter({
    path: filePath,
    header: [
      { id: 'category', title: '统计类别' },
      { id: 'key', title: '项目' },
      { id: 'value', title: '数值' },
      { id: 'extra', title: '备注' }
    ]
  });
  
  const records: any[] = [];
  
  slotStats.forEach(stat => {
    records.push({
      category: '号源统计',
      key: `${stat.date} - ${stat.department_name}`,
      value: stat.slot_count,
      extra: `总${stat.total_count}/可用${stat.available_count}/已锁${stat.locked_count}`
    });
  });
  
  voucherStats.forEach(stat => {
    records.push({
      category: '凭证统计',
      key: stat.status,
      value: stat.count,
      extra: ''
    });
  });
  
  conflictStats.forEach(stat => {
    records.push({
      category: '冲突统计',
      key: `${stat.conflict_type} - ${stat.status}`,
      value: stat.count,
      extra: ''
    });
  });
  
  await csvWriter.writeRecords(records);
  return filePath;
}
