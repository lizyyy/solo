import { Parser } from 'json2csv';
import { Ticket, SampleRecord, AuditLog, User, Store, Pool, Threshold, DeviceCalibration, SampleType, TicketStatus } from '../types';
import { getTicketsByStore, getTicketById, getAllTickets } from '../storage/ticketRepository';
import { getSampleRecordsByStore, getSampleRecordById } from '../storage/sampleRecordRepository';
import { getAuditLogs, getVersionRecords } from '../storage/auditRepository';
import { getStoreById, getAllStores } from '../storage/storeRepository';
import { getPoolById, getPoolsByStore } from '../storage/poolRepository';
import { getAllThresholds } from '../storage/thresholdRepository';
import { getDeviceCalibrationsByStore } from '../storage/deviceCalibrationRepository';
import dayjs from 'dayjs';

export interface AuditPackage {
  meta: {
    generatedAt: string;
    generatedBy: string;
    storeId?: string;
    timeRange?: {
      start: string;
      end: string;
    };
  };
  stores: Store[];
  pools: Pool[];
  thresholds: Threshold[];
  deviceCalibrations: DeviceCalibration[];
  sampleRecords: SampleRecord[];
  tickets: Ticket[];
  auditLogs: AuditLog[];
}

export function generateAuditPackage(
  user: User,
  options?: {
    storeId?: string;
    startDate?: string;
    endDate?: string;
  }
): AuditPackage {
  const meta: AuditPackage['meta'] = {
    generatedAt: new Date().toISOString(),
    generatedBy: user.username,
    storeId: options?.storeId
  };

  if (options?.startDate && options?.endDate) {
    meta.timeRange = {
      start: options.startDate,
      end: options.endDate
    };
  }

  let stores: Store[] = [];
  let pools: Pool[] = [];
  let deviceCalibrations: DeviceCalibration[] = [];
  let sampleRecords: SampleRecord[] = [];
  let tickets: Ticket[] = [];

  if (options?.storeId) {
    const store = getStoreById(options.storeId);
    if (store) {
      stores = [store];
      pools = getPoolsByStore(options.storeId);
      deviceCalibrations = getDeviceCalibrationsByStore(options.storeId);
      
      const sampleOptions = options.startDate && options.endDate 
        ? { startDate: options.startDate, endDate: options.endDate }
        : undefined;
      sampleRecords = getSampleRecordsByStore(options.storeId, sampleOptions);
      tickets = getTicketsByStore(options.storeId);
    }
  } else {
    stores = getAllStores();
    tickets = getAllTickets();
  }

  const thresholds = getAllThresholds();
  
  const auditOptions: Parameters<typeof getAuditLogs>[0] = {};
  if (options?.startDate) auditOptions.startDate = options.startDate;
  if (options?.endDate) auditOptions.endDate = options.endDate;
  const auditLogs = getAuditLogs(auditOptions);

  return {
    meta,
    stores,
    pools,
    thresholds,
    deviceCalibrations,
    sampleRecords,
    tickets,
    auditLogs
  };
}

export function exportToJson(pkg: AuditPackage): string {
  return JSON.stringify(pkg, null, 2);
}

export function exportToCsv(pkg: AuditPackage): { [key: string]: string } {
  const results: { [key: string]: string } = {};

  const storeParser = new Parser<Store>({
    fields: ['id', 'name', 'address', 'contactPerson', 'contactPhone', 'isActive', 'createdAt']
  });
  if (pkg.stores.length > 0) {
    results['stores.csv'] = storeParser.parse(pkg.stores);
  }

  const poolParser = new Parser<Pool>({
    fields: ['id', 'storeId', 'name', 'type', 'volume', 'isActive', 'createdAt']
  });
  if (pkg.pools.length > 0) {
    results['pools.csv'] = poolParser.parse(pkg.pools);
  }

  const thresholdParser = new Parser<Threshold>({
    fields: ['id', 'sampleType', 'minValue', 'maxValue', 'unit', 'description']
  });
  if (pkg.thresholds.length > 0) {
    results['thresholds.csv'] = thresholdParser.parse(pkg.thresholds);
  }

  const calibrationParser = new Parser<DeviceCalibration>({
    fields: ['id', 'storeId', 'deviceName', 'deviceType', 'serialNumber', 'calibrationDate', 'validUntil', 'calibratedBy']
  });
  if (pkg.deviceCalibrations.length > 0) {
    results['device_calibrations.csv'] = calibrationParser.parse(pkg.deviceCalibrations);
  }

  const sampleParser = new Parser<SampleRecord>({
    fields: ['id', 'storeId', 'poolId', 'sampleType', 'value', 'unit', 'sampleTime', 'recordedBy', 'isExceeded', 'ticketId']
  });
  if (pkg.sampleRecords.length > 0) {
    results['sample_records.csv'] = sampleParser.parse(pkg.sampleRecords);
  }

  const ticketParser = new Parser<Ticket>({
    fields: [
      'id', 'storeId', 'poolId', 'sampleRecordId', 'sampleType',
      'exceededValue', 'thresholdMin', 'thresholdMax', 'status',
      'assignedTo', 'rectificationDescription', 'rectificationTime',
      'retestValue', 'retestTime', 'retestPassed',
      'closeReason', 'closedTime', 'createdAt'
    ]
  });
  if (pkg.tickets.length > 0) {
    results['tickets.csv'] = ticketParser.parse(pkg.tickets);
  }

  const auditParser = new Parser<AuditLog>({
    fields: ['id', 'entityType', 'entityId', 'action', 'userId', 'username', 'userRole', 'timestamp']
  });
  if (pkg.auditLogs.length > 0) {
    results['audit_logs.csv'] = auditParser.parse(pkg.auditLogs);
  }

  return results;
}

export function exportToMarkdown(pkg: AuditPackage): string {
  const lines: string[] = [];

  lines.push('# 水质整改闭环审计报告');
  lines.push('');
  lines.push(`**生成时间**: ${dayjs(pkg.meta.generatedAt).format('YYYY-MM-DD HH:mm:ss')}`);
  lines.push(`**生成人**: ${pkg.meta.generatedBy}`);
  if (pkg.meta.storeId) {
    const store = pkg.stores.find(s => s.id === pkg.meta.storeId);
    lines.push(`**门店**: ${store ? store.name : pkg.meta.storeId}`);
  }
  if (pkg.meta.timeRange) {
    lines.push(`**时间范围**: ${dayjs(pkg.meta.timeRange.start).format('YYYY-MM-DD')} 至 ${dayjs(pkg.meta.timeRange.end).format('YYYY-MM-DD')}`);
  }
  lines.push('');
  lines.push('---');
  lines.push('');

  lines.push('## 1. 阈值配置');
  lines.push('');
  lines.push('| 采样类型 | 最小值 | 最大值 | 单位 | 说明 |');
  lines.push('|---------|--------|--------|------|------|');
  pkg.thresholds.forEach(t => {
    const typeMap: Record<string, string> = {
      'chlorine': '余氯',
      'ph': 'pH',
      'turbidity': '浊度'
    };
    lines.push(`| ${typeMap[t.sampleType] || t.sampleType} | ${t.minValue} | ${t.maxValue} | ${t.unit} | ${t.description || '-'} |`);
  });
  lines.push('');

  lines.push('## 2. 门店信息');
  lines.push('');
  lines.push('| 门店名称 | 地址 | 联系人 | 联系电话 | 状态 |');
  lines.push('|---------|------|--------|----------|------|');
  pkg.stores.forEach(s => {
    lines.push(`| ${s.name} | ${s.address} | ${s.contactPerson} | ${s.contactPhone} | ${s.isActive ? '激活' : '停用'} |`);
  });
  lines.push('');

  lines.push('## 3. 泳池信息');
  lines.push('');
  lines.push('| 所属门店 | 泳池名称 | 类型 | 容积(m³) | 状态 |');
  lines.push('|---------|---------|------|----------|------|');
  pkg.pools.forEach(p => {
    const store = pkg.stores.find(s => s.id === p.storeId);
    lines.push(`| ${store?.name || p.storeId} | ${p.name} | ${p.type} | ${p.volume} | ${p.isActive ? '激活' : '停用'} |`);
  });
  lines.push('');

  lines.push('## 4. 设备校准记录');
  lines.push('');
  if (pkg.deviceCalibrations.length > 0) {
    lines.push('| 设备名称 | 类型 | 序列号 | 校准日期 | 有效期至 | 校准人 |');
    lines.push('|---------|------|--------|----------|----------|--------|');
    pkg.deviceCalibrations.forEach(c => {
      const store = pkg.stores.find(s => s.id === c.storeId);
      lines.push(`| ${c.deviceName} | ${c.deviceType} | ${c.serialNumber} | ${dayjs(c.calibrationDate).format('YYYY-MM-DD')} | ${dayjs(c.validUntil).format('YYYY-MM-DD')} | ${c.calibratedBy} |`);
    });
  } else {
    lines.push('无设备校准记录');
  }
  lines.push('');

  lines.push('## 5. 采样记录');
  lines.push('');
  if (pkg.sampleRecords.length > 0) {
    lines.push('| 采样时间 | 泳池 | 类型 | 数值 | 单位 | 记录人 | 是否超标 | 工单ID |');
    lines.push('|----------|------|------|------|------|--------|----------|--------|');
    const typeMap: Record<string, string> = {
      'chlorine': '余氯',
      'ph': 'pH',
      'turbidity': '浊度'
    };
    pkg.sampleRecords.forEach(s => {
      const pool = pkg.pools.find(p => p.id === s.poolId);
      lines.push(`| ${dayjs(s.sampleTime).format('YYYY-MM-DD HH:mm')} | ${pool?.name || s.poolId} | ${typeMap[s.sampleType] || s.sampleType} | ${s.value} | ${s.unit} | ${s.recordedBy} | ${s.isExceeded ? '**是**' : '否'} | ${s.ticketId || '-'} |`);
    });
  } else {
    lines.push('无采样记录');
  }
  lines.push('');

  lines.push('## 6. 整改工单');
  lines.push('');
  if (pkg.tickets.length > 0) {
    lines.push('| 工单ID | 泳池 | 类型 | 超标值 | 状态 | 指派人 | 整改时间 | 复测值 | 关闭时间 |');
    lines.push('|--------|------|------|--------|------|--------|----------|--------|----------|');
    const typeMap: Record<string, string> = {
      'chlorine': '余氯',
      'ph': 'pH',
      'turbidity': '浊度'
    };
    const statusMap: Record<string, string> = {
      'created': '已创建',
      'assigned': '已派发',
      'in_progress': '整改中',
      'retest_requested': '申请复测',
      'retest_failed': '复测失败',
      'reopen_requested': '申请复开',
      'closed': '已关闭',
      'archived': '已归档'
    };
    pkg.tickets.forEach(t => {
      const pool = pkg.pools.find(p => p.id === t.poolId);
      lines.push(`| ${t.id.substring(0, 8)}... | ${pool?.name || t.poolId} | ${typeMap[t.sampleType] || t.sampleType} | ${t.exceededValue} | ${statusMap[t.status] || t.status} | ${t.assignedTo || '-'} | ${t.rectificationTime ? dayjs(t.rectificationTime).format('MM-DD HH:mm') : '-'} | ${t.retestValue || '-'} | ${t.closedTime ? dayjs(t.closedTime).format('MM-DD HH:mm') : '-'} |`);
    });
  } else {
    lines.push('无整改工单');
  }
  lines.push('');

  lines.push('## 7. 审计日志');
  lines.push('');
  if (pkg.auditLogs.length > 0) {
    lines.push('| 时间 | 操作人 | 角色 | 操作 | 实体类型 | 实体ID |');
    lines.push('|------|--------|------|------|----------|--------|');
    const roleMap: Record<string, string> = {
      'admin': '管理员',
      'supervisor': '督导',
      'store_staff': '门店员工'
    };
    pkg.auditLogs.slice(0, 100).forEach(log => {
      lines.push(`| ${dayjs(log.timestamp).format('YYYY-MM-DD HH:mm:ss')} | ${log.username} | ${roleMap[log.userRole] || log.userRole} | ${log.action} | ${log.entityType} | ${log.entityId.substring(0, 8)}... |`);
    });
    if (pkg.auditLogs.length > 100) {
      lines.push('');
      lines.push(`*注：共 ${pkg.auditLogs.length} 条日志，仅显示前100条*`);
    }
  } else {
    lines.push('无审计日志');
  }
  lines.push('');

  lines.push('---');
  lines.push('');
  lines.push('*此报告由水质整改闭环系统自动生成*');

  return lines.join('\n');
}
