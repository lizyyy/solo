const ExcelJS = require('exceljs');
const dayjs = require('dayjs');
const storage = require('../utils/storage');

const FILE_APPOINTMENTS = 'appointments';
const FILE_ACCIDENTS = 'accidents';
const FILE_SALESPERSONS = 'salespersons';
const FILE_VEHICLES = 'vehicles';

function getStatusText(status) {
  const map = {
    pending: '待确认',
    confirmed: '已确认',
    in_progress: '试驾中',
    completed: '已完成',
    cancelled: '已取消',
    rejected: '已拒绝',
    no_show_released: '爽约释放'
  };
  return map[status] || status;
}

function getTimelineTypeText(type) {
  const map = {
    validation: '规则校验',
    status_change: '状态变更',
    correction: '人工修正',
    accident: '事故处理'
  };
  return map[type] || type;
}

function getAccidentStatusText(status) {
  const map = {
    pending_review: '待审核',
    resolved: '已处理',
    disputed: '有争议',
    pending_followup: '待跟进'
  };
  return map[status] || status;
}

function filterAppointments(filters = {}) {
  const appointments = storage.readData(FILE_APPOINTMENTS);
  const salespersons = storage.readData(FILE_SALESPERSONS);
  const salespersonMap = {};
  salespersons.forEach(s => { salespersonMap[s.id] = s; });
  
  let filtered = [...appointments];
  
  if (filters.salespersonId) {
    filtered = filtered.filter(a => a.salespersonId === filters.salespersonId);
  }
  
  if (filters.processStartTime) {
    const start = dayjs(filters.processStartTime).startOf('day');
    filtered = filtered.filter(a => {
      const lastTimeline = a.timeline?.[a.timeline.length - 1];
      if (!lastTimeline) return false;
      return dayjs(lastTimeline.timestamp).isAfter(start);
    });
  }
  
  if (filters.processEndTime) {
    const end = dayjs(filters.processEndTime).endOf('day');
    filtered = filtered.filter(a => {
      const lastTimeline = a.timeline?.[a.timeline.length - 1];
      if (!lastTimeline) return false;
      return dayjs(lastTimeline.timestamp).isBefore(end);
    });
  }
  
  if (filters.status) {
    filtered = filtered.filter(a => a.status === filters.status);
  }
  
  if (filters.hasAccident) {
    filtered = filtered.filter(a => a.hasAccident === true);
  }
  
  return filtered.map(a => ({
    ...a,
    salesperson: salespersonMap[a.salespersonId]
  }));
}

async function exportAppointmentReport(filters = {}, outputPath) {
  const appointments = filterAppointments(filters);
  
  const workbook = new ExcelJS.Workbook();
  
  const summarySheet = workbook.addWorksheet('预约汇总');
  summarySheet.columns = [
    { header: '预约ID', key: 'id', width: 36 },
    { header: '客户姓名', key: 'customerName', width: 15 },
    { header: '联系电话', key: 'customerPhone', width: 15 },
    { header: '驾照号', key: 'licenseNumber', width: 20 },
    { header: '驾照有效期', key: 'licenseExpiry', width: 18 },
    { header: '驾照状态', key: 'licenseStatus', width: 12 },
    { header: '试驾车', key: 'vehicleModel', width: 20 },
    { header: '销售顾问', key: 'salespersonName', width: 15 },
    { header: '预约开始时间', key: 'startTime', width: 20 },
    { header: '预约结束时间', key: 'endTime', width: 20 },
    { header: '当前状态', key: 'status', width: 12 },
    { header: '是否有事故', key: 'hasAccident', width: 10 },
    { header: '创建时间', key: 'createdAt', width: 20 },
    { header: '最后处理时间', key: 'lastProcessTime', width: 20 },
    { header: '最后处理人', key: 'lastOperator', width: 15 }
  ];
  
  appointments.forEach(a => {
    const lastTimeline = a.timeline?.[a.timeline.length - 1];
    summarySheet.addRow({
      id: a.id,
      customerName: a.customerName,
      customerPhone: a.customerPhone,
      licenseNumber: a.license?.number,
      licenseExpiry: a.license?.expiryDate,
      licenseStatus: a.license?.valid ? (a.license?.warning ? '即将过期' : '有效') : '过期/无效',
      vehicleModel: a.vehicleSnapshot?.model || a.vehicleId,
      salespersonName: a.salesperson?.name || a.salespersonId,
      startTime: a.startTime,
      endTime: a.endTime,
      status: getStatusText(a.status),
      hasAccident: a.hasAccident ? '是' : '否',
      createdAt: a.createdAt,
      lastProcessTime: lastTimeline?.timestamp,
      lastOperator: lastTimeline?.operator
    });
  });
  
  summarySheet.getRow(1).font = { bold: true };
  summarySheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' }
  };
  
  const detailSheet = workbook.addWorksheet('处理时间线');
  detailSheet.columns = [
    { header: '预约ID', key: 'appointmentId', width: 36 },
    { header: '客户姓名', key: 'customerName', width: 15 },
    { header: '时间点', key: 'timestamp', width: 20 },
    { header: '类型', key: 'type', width: 12 },
    { header: '操作', key: 'action', width: 20 },
    { header: '变更原因', key: 'reason', width: 40 },
    { header: '操作人', key: 'operator', width: 15 },
    { header: '变更前值', key: 'oldValue', width: 50 },
    { header: '变更后值', key: 'newValue', width: 50 }
  ];
  
  appointments.forEach(a => {
    (a.timeline || []).forEach(t => {
      detailSheet.addRow({
        appointmentId: a.id,
        customerName: a.customerName,
        timestamp: t.timestamp,
        type: getTimelineTypeText(t.type),
        action: t.action,
        reason: t.reason,
        operator: t.operator,
        oldValue: t.oldValue ? JSON.stringify(t.oldValue) : '',
        newValue: t.newValue ? JSON.stringify(t.newValue) : ''
      });
    });
  });
  
  detailSheet.getRow(1).font = { bold: true };
  detailSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' }
  };
  
  const accidentSheet = workbook.addWorksheet('事故登记');
  accidentSheet.columns = [
    { header: '事故ID', key: 'id', width: 36 },
    { header: '关联预约ID', key: 'appointmentId', width: 36 },
    { header: '客户姓名', key: 'customerName', width: 15 },
    { header: '试驾车', key: 'vehicleModel', width: 20 },
    { header: '销售顾问', key: 'salespersonName', width: 15 },
    { header: '事故类型', key: 'type', width: 15 },
    { header: '事故描述', key: 'description', width: 50 },
    { header: '损失金额', key: 'damageAmount', width: 12 },
    { header: '责任方', key: 'responsibleParty', width: 15 },
    { header: '状态', key: 'status', width: 12 },
    { header: '登记时间', key: 'createdAt', width: 20 },
    { header: '处理人', key: 'processedBy', width: 15 },
    { header: '处理时间', key: 'processedAt', width: 20 },
    { header: '处理备注', key: 'processNotes', width: 40 }
  ];
  
  const accidents = storage.readData(FILE_ACCIDENTS);
  const vehicles = storage.readData(FILE_VEHICLES);
  const vehicleMap = {};
  vehicles.forEach(v => { vehicleMap[v.id] = v; });
  
  accidents
    .filter(acc => {
      if (!filters.salespersonId && !filters.processStartTime && !filters.processEndTime) {
        return appointments.some(a => a.id === acc.appointmentId);
      }
      return appointments.some(a => a.id === acc.appointmentId);
    })
    .forEach(acc => {
      accidentSheet.addRow({
        id: acc.id,
        appointmentId: acc.appointmentId,
        customerName: acc.customerName,
        vehicleModel: vehicleMap[acc.vehicleId]?.model || acc.vehicleId,
        salespersonName: salespersons.find(s => s.id === acc.salespersonId)?.name || acc.salespersonId,
        type: acc.type,
        description: acc.description,
        damageAmount: acc.damageAmount,
        responsibleParty: acc.responsibleParty,
        status: getAccidentStatusText(acc.status),
        createdAt: acc.createdAt,
        processedBy: acc.processedBy,
        processedAt: acc.processedAt,
        processNotes: acc.processNotes
      });
    });
  
  accidentSheet.getRow(1).font = { bold: true };
  accidentSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' }
  };
  
  await workbook.xlsx.writeFile(outputPath);
  return { 
    success: true, 
    filePath: outputPath, 
    appointmentCount: appointments.length,
    accidentCount: accidents.length
  };
}

async function exportSingleAppointmentReport(appointmentId, outputPath) {
  const appointments = storage.readData(FILE_APPOINTMENTS);
  const appointment = appointments.find(a => a.id === appointmentId);
  
  if (!appointment) {
    return { success: false, reason: '预约不存在' };
  }
  
  const salespersons = storage.readData(FILE_SALESPERSONS);
  const vehicles = storage.readData(FILE_VEHICLES);
  const salesperson = salespersons.find(s => s.id === appointment.salespersonId);
  const vehicle = vehicles.find(v => v.id === appointment.vehicleId);
  
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('预约详情');
  
  sheet.mergeCells('A1:B1');
  sheet.getCell('A1').value = '预约详情报告';
  sheet.getCell('A1').font = { size: 16, bold: true };
  sheet.getCell('A1').alignment = { horizontal: 'center' };
  
  sheet.addRow([]);
  
  sheet.addRow(['预约ID', appointment.id]);
  sheet.addRow(['客户姓名', appointment.customerName]);
  sheet.addRow(['联系电话', appointment.customerPhone]);
  sheet.addRow(['当前状态', getStatusText(appointment.status)]);
  sheet.addRow(['创建时间', appointment.createdAt]);
  sheet.addRow(['最后更新时间', appointment.updatedAt]);
  
  sheet.addRow([]);
  sheet.addRow(['驾照信息']);
  sheet.getCell('A' + sheet.lastRow.number).font = { bold: true };
  sheet.addRow(['驾照号', appointment.license?.number]);
  sheet.addRow(['驾照有效期', appointment.license?.expiryDate]);
  sheet.addRow(['驾照效期检查结果', appointment.licenseCheck?.reason]);
  if (appointment.licenseCheck?.warning) {
    sheet.getCell('B' + sheet.lastRow.number).font = { color: { argb: 'FFFF6600' } };
  } else if (!appointment.licenseCheck?.valid) {
    sheet.getCell('B' + sheet.lastRow.number).font = { color: { argb: 'FFFF0000' } };
  }
  
  sheet.addRow([]);
  sheet.addRow(['试驾车信息']);
  sheet.getCell('A' + sheet.lastRow.number).font = { bold: true };
  sheet.addRow(['车辆ID', vehicle?.id || appointment.vehicleId]);
  sheet.addRow(['车型', vehicle?.model || appointment.vehicleSnapshot?.model]);
  sheet.addRow(['车牌号', vehicle?.plateNumber || appointment.vehicleSnapshot?.plateNumber]);
  sheet.addRow(['车辆可用性检查', appointment.vehicleCheck?.reason]);
  
  sheet.addRow([]);
  sheet.addRow(['保险信息']);
  sheet.getCell('A' + sheet.lastRow.number).font = { bold: true };
  if (appointment.vehicleSnapshot?.insurance) {
    sheet.addRow(['保险公司', appointment.vehicleSnapshot.insurance.company]);
    sheet.addRow(['保险单号', appointment.vehicleSnapshot.insurance.policyNumber]);
    sheet.addRow(['保险到期时间', appointment.vehicleSnapshot.insurance.expiryDate]);
  }
  sheet.addRow(['保险规则检查', appointment.insuranceCheck?.valid ? '通过' : '未通过']);
  if (appointment.insuranceCheck?.warnings?.length) {
    appointment.insuranceCheck.warnings.forEach(w => {
      sheet.addRow(['保险警告', w.reason]);
    });
  }
  
  sheet.addRow([]);
  sheet.addRow(['销售顾问信息']);
  sheet.getCell('A' + sheet.lastRow.number).font = { bold: true };
  sheet.addRow(['销售ID', salesperson?.id || appointment.salespersonId]);
  sheet.addRow(['销售姓名', salesperson?.name || appointment.salespersonSnapshot?.name]);
  sheet.addRow(['联系电话', salesperson?.phone || appointment.salespersonSnapshot?.phone]);
  sheet.addRow(['日程检查结果', appointment.salespersonCheck?.reason]);
  
  sheet.addRow([]);
  sheet.addRow(['事故信息']);
  sheet.getCell('A' + sheet.lastRow.number).font = { bold: true };
  if (appointment.hasAccident) {
    const accidents = storage.readData(FILE_ACCIDENTS);
    const accident = accidents.find(a => a.id === appointment.accidentId);
    if (accident) {
      sheet.addRow(['事故ID', accident.id]);
      sheet.addRow(['事故类型', accident.type]);
      sheet.addRow(['事故描述', accident.description]);
      sheet.addRow(['损失金额', accident.damageAmount]);
      sheet.addRow(['责任方', accident.responsibleParty]);
      sheet.addRow(['事故状态', getAccidentStatusText(accident.status)]);
    }
  } else {
    sheet.addRow(['', '无事故记录']);
  }
  
  sheet.addRow([]);
  sheet.addRow(['处理时间线（含修改前后值）']);
  sheet.getCell('A' + sheet.lastRow.number).font = { bold: true };
  
  sheet.addRow(['时间', '类型', '操作', '原因', '操作人', '变更前', '变更后']);
  sheet.getRow(sheet.lastRow.number).font = { bold: true };
  
  (appointment.timeline || []).forEach(t => {
    sheet.addRow([
      t.timestamp,
      getTimelineTypeText(t.type),
      t.action,
      t.reason,
      t.operator,
      t.oldValue ? JSON.stringify(t.oldValue, null, 2) : '',
      t.newValue ? JSON.stringify(t.newValue, null, 2) : ''
    ]);
  });
  
  sheet.columns = [
    { width: 22 }, { width: 20 }, { width: 15 }, { width: 15 },
    { width: 40 }, { width: 15 }, { width: 40 }, { width: 40 }
  ];
  
  await workbook.xlsx.writeFile(outputPath);
  return { success: true, filePath: outputPath };
}

module.exports = {
  filterAppointments,
  exportAppointmentReport,
  exportSingleAppointmentReport
};
