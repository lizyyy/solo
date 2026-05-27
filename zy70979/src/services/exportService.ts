import { createObjectCsvStringifier } from 'csv-writer';
import { Database } from '../database';
import { ExportFilter } from '../types';

export async function exportMaterials(db: Database, filter: ExportFilter = {}) {
  let query = `
    SELECT 
      m.id,
      m.batch_id,
      b.name as batch_name,
      m.order_no,
      m.equipment_serial,
      e.name as equipment_name,
      e.model as equipment_model,
      m.customer_name,
      m.rental_start_date,
      m.rental_end_date,
      m.actual_return_date,
      m.deposit_amount,
      m.overdue_days,
      m.overdue_fee,
      m.repair_cost,
      m.deduction_amount,
      m.status,
      m.status_reason,
      m.next_action,
      m.processed_by,
      m.processed_at,
      m.created_at,
      m.updated_at
    FROM materials m
    LEFT JOIN batches b ON m.batch_id = b.id
    LEFT JOIN equipment e ON m.equipment_serial = e.serial_number
    WHERE 1=1
  `;
  
  const params: any[] = [];

  if (filter.batchId) {
    query += ' AND m.batch_id = ?';
    params.push(filter.batchId);
  }

  if (filter.status) {
    query += ' AND m.status = ?';
    params.push(filter.status);
  }

  if (filter.startDate) {
    query += ' AND m.created_at >= ?';
    params.push(filter.startDate);
  }

  if (filter.endDate) {
    query += ' AND m.created_at <= ?';
    params.push(filter.endDate);
  }

  query += ' ORDER BY m.created_at DESC';

  const materials = await db.all(query, ...params);

  const materialIds = materials.map((m: any) => m.id);
  
  const changeCounts = materialIds.length > 0 ? await db.all(
    `SELECT material_id, COUNT(*) as change_count 
     FROM processing_records 
     WHERE material_id IN (${materialIds.map(() => '?').join(',')})
     GROUP BY material_id`,
    ...materialIds
  ) : [];

  const changeCountMap = new Map(
    changeCounts.map((c: any) => [c.material_id, c.change_count])
  );

  const statusMap: Record<string, string> = {
    'normal': '正常',
    'pending': '待补充',
    'blocked': '已拦截'
  };

  const records = materials.map((m: any) => ({
    id: m.id,
    batchName: m.batch_name || '',
    orderNo: m.order_no,
    equipmentSerial: m.equipment_serial,
    equipmentName: m.equipment_name || '',
    equipmentModel: m.equipment_model || '',
    customerName: m.customer_name,
    rentalStartDate: m.rental_start_date,
    rentalEndDate: m.rental_end_date,
    actualReturnDate: m.actual_return_date || '',
    depositAmount: m.deposit_amount,
    overdueDays: m.overdue_days || 0,
    overdueFee: m.overdue_fee || 0,
    repairCost: m.repair_cost || 0,
    deductionAmount: m.deduction_amount || 0,
    status: statusMap[m.status] || m.status,
    statusReason: m.status_reason,
    nextAction: m.next_action,
    processedBy: m.processed_by || '',
    processedAt: m.processed_at || '',
    changeCount: changeCountMap.get(m.id) || 0,
    createdAt: m.created_at
  }));

  return records;
}

export async function exportToCsv(db: Database, filter: ExportFilter = {}) {
  const records = await exportMaterials(db, filter);

  const csvStringifier = createObjectCsvStringifier({
    header: [
      { id: 'id', title: '材料ID' },
      { id: 'batchName', title: '批次名称' },
      { id: 'orderNo', title: '订单编号' },
      { id: 'equipmentSerial', title: '设备序列号' },
      { id: 'equipmentName', title: '设备名称' },
      { id: 'equipmentModel', title: '设备型号' },
      { id: 'customerName', title: '客户名称' },
      { id: 'rentalStartDate', title: '租赁起始日期' },
      { id: 'rentalEndDate', title: '租赁结束日期' },
      { id: 'actualReturnDate', title: '实际归还日期' },
      { id: 'depositAmount', title: '押金金额' },
      { id: 'overdueDays', title: '逾期天数' },
      { id: 'overdueFee', title: '逾期费用' },
      { id: 'repairCost', title: '维修费用' },
      { id: 'deductionAmount', title: '扣减金额' },
      { id: 'status', title: '状态' },
      { id: 'statusReason', title: '状态原因' },
      { id: 'nextAction', title: '后续动作' },
      { id: 'processedBy', title: '处理人' },
      { id: 'processedAt', title: '处理时间' },
      { id: 'changeCount', title: '修改次数' },
      { id: 'createdAt', title: '创建时间' }
    ]
  });

  const csv = '\uFEFF' + csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(records);
  
  return {
    csv,
    statistics: {
      total: records.length,
      normal: records.filter(r => r.status === '正常').length,
      pending: records.filter(r => r.status === '待补充').length,
      blocked: records.filter(r => r.status === '已拦截').length,
      totalDeduction: records.reduce((sum, r) => sum + r.deductionAmount, 0),
      totalOverdueFee: records.reduce((sum, r) => sum + r.overdueFee, 0),
      totalRepairCost: records.reduce((sum, r) => sum + r.repairCost, 0)
    }
  };
}

export async function getEquipmentTrackingReport(db: Database, serialNumber: string) {
  const equipment = await db.get(
    'SELECT * FROM equipment WHERE serial_number = ?',
    serialNumber
  );

  if (!equipment) {
    return null;
  }

  const materials = await db.all(
    `SELECT 
      m.*,
      b.name as batch_name,
      dr.amount as deduction_amount,
      dr.deduction_type,
      dr.reason as deduction_reason,
      dr.processed_by as deduction_processor,
      dr.created_at as deduction_time,
      dr.is_duplicate
     FROM materials m
     LEFT JOIN batches b ON m.batch_id = b.id
     LEFT JOIN deduction_records dr ON m.id = dr.material_id
     WHERE m.equipment_serial = ?
     ORDER BY m.created_at DESC`,
    serialNumber
  );

  const rentalOrders = await db.all(
    `SELECT * FROM rental_orders 
     WHERE equipment_serial = ? 
     ORDER BY start_date DESC`,
    serialNumber
  );

  const lastProcessor = materials.length > 0 ? 
    (materials[0].deduction_processor || materials[0].processed_by) : null;

  return {
    equipment: {
      serialNumber: equipment.serial_number,
      name: equipment.name,
      model: equipment.model,
      currentStatus: equipment.current_status,
      totalRentalCount: equipment.total_rental_count,
      totalRepairCost: equipment.total_repair_cost,
      lastMaintenanceDate: equipment.last_maintenance_date
    },
    rentalOrders,
    depositRecords: materials.map((m: any) => ({
      orderNo: m.order_no,
      batchName: m.batch_name,
      customerName: m.customer_name,
      rentalPeriod: `${m.rental_start_date} 至 ${m.rental_end_date}`,
      actualReturnDate: m.actual_return_date,
      depositAmount: m.deposit_amount,
      overdueDays: m.overdue_days,
      overdueFee: m.overdue_fee,
      repairCost: m.repair_cost,
      totalDeduction: m.deduction_amount,
      status: m.status,
      processor: m.deduction_processor || m.processed_by,
      processedAt: m.deduction_time || m.processed_at
    })),
    summary: {
      totalRentals: rentalOrders.length,
      totalDeductions: materials.reduce((sum: number, m: any) => 
        sum + (m.deduction_amount || 0), 0
      ),
      totalOverdueFees: materials.reduce((sum: number, m: any) => 
        sum + (m.overdue_fee || 0), 0
      ),
      totalRepairCosts: materials.reduce((sum: number, m: any) => 
        sum + (m.repair_cost || 0), 0
      ),
      duplicateDeductions: materials.filter((m: any) => m.is_duplicate).length,
      lastProcessor
    }
  };
}

export async function getOrderTrackingReport(db: Database, orderNo: string) {
  const order = await db.get(
    'SELECT * FROM rental_orders WHERE order_no = ?',
    orderNo
  );

  if (!order) {
    return null;
  }

  const materials = await db.all(
    `SELECT 
      m.*,
      b.name as batch_name,
      dr.amount as deduction_record_amount,
      dr.deduction_type,
      dr.processed_by as deduction_processor
     FROM materials m
     LEFT JOIN batches b ON m.batch_id = b.id
     LEFT JOIN deduction_records dr ON m.id = dr.material_id
     WHERE m.order_no = ?
     ORDER BY m.created_at DESC`,
    orderNo
  );

  const processingRecords = await db.all(
    `SELECT pr.*, a.old_value, a.new_value, a.reason as audit_reason
     FROM processing_records pr
     JOIN materials m ON pr.material_id = m.id
     LEFT JOIN audit_logs a ON a.entity_id = pr.material_id AND a.action = 'reclassify'
     WHERE m.order_no = ?
     ORDER BY pr.created_at DESC`,
    orderNo
  );

  return {
    order,
    materials,
    processingRecords,
    lastProcessor: materials.length > 0 ? 
      (materials[0].deduction_processor || materials[0].processed_by) : null
  };
}
