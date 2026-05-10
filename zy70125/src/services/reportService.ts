import { getDB } from '../storage';
import { getCaseStatusLabel } from './caseService';
import { getCityByIdentifier } from './cityService';
import { getDamageSeverityLabel } from './damageService';
import { ServiceResult } from '../types';

export interface InventoryReport {
  totalCases: number;
  totalValue: number;
  byStatus: Record<string, { count: number; value: number }>;
  byCity: Array<{
    cityId: string;
    cityName: string;
    cityCode: string;
    count: number;
    value: number;
  }>;
  itemsSummary: Array<{
    name: string;
    totalQuantity: number;
    totalValue: number;
  }>;
}

export interface AuditReport {
  totalBorrowRecords: number;
  activeBorrowCount: number;
  completedBorrowCount: number;
  totalDamageRecords: number;
  unresolvedDamageCount: number;
  totalRepairRecords: number;
  inProgressRepairCount: number;
  totalCompensationActions: number;
  pendingCompensationCount: number;
  permanentFailedCompensationCount: number;
  totalTours: number;
  activeToursCount: number;
  completedToursCount: number;
}

export interface CaseHistoryReport {
  caseNumber: string;
  caseName: string;
  currentStatus: string;
  currentCity: string;
  totalValue: number;
  borrowHistory: Array<{
    id: string;
    fromCity: string;
    toCity: string;
    borrowedBy: string;
    borrowTime: string;
    returnTime?: string;
    status: string;
  }>;
  damageHistory: Array<{
    id: string;
    city: string;
    severity: string;
    reportedBy: string;
    reportedTime: string;
    isResolved: boolean;
  }>;
  repairHistory: Array<{
    id: string;
    startedBy: string;
    startTime: string;
    endTime?: string;
    status: string;
    cost?: number;
  }>;
}

export function getInventoryReport(): ServiceResult<InventoryReport> {
  const db = getDB();
  
  const byStatus: Record<string, { count: number; value: number }> = {};
  const cityMap: Map<string, { count: number; value: number }> = new Map();
  const itemsMap: Map<string, { quantity: number; value: number }> = new Map();
  
  for (const caseObj of db.equipmentCases) {
    const statusLabel = getCaseStatusLabel(caseObj.status);
    if (!byStatus[statusLabel]) {
      byStatus[statusLabel] = { count: 0, value: 0 };
    }
    byStatus[statusLabel].count++;
    byStatus[statusLabel].value += caseObj.totalValue;
    
    if (!cityMap.has(caseObj.currentCityId)) {
      cityMap.set(caseObj.currentCityId, { count: 0, value: 0 });
    }
    const cityData = cityMap.get(caseObj.currentCityId)!;
    cityData.count++;
    cityData.value += caseObj.totalValue;
    
    for (const item of caseObj.items) {
      if (!itemsMap.has(item.name)) {
        itemsMap.set(item.name, { quantity: 0, value: 0 });
      }
      const itemData = itemsMap.get(item.name)!;
      itemData.quantity += item.quantity;
      itemData.value += item.quantity * item.unitValue;
    }
  }
  
  const byCity: InventoryReport['byCity'] = [];
  for (const [cityId, data] of cityMap) {
    const cityResult = getCityByIdentifier(cityId);
    byCity.push({
      cityId,
      cityName: cityResult.success ? cityResult.data!.name : '未知城市',
      cityCode: cityResult.success ? cityResult.data!.code : 'UNKNOWN',
      count: data.count,
      value: data.value,
    });
  }
  byCity.sort((a, b) => b.value - a.value);
  
  const itemsSummary: InventoryReport['itemsSummary'] = [];
  for (const [name, data] of itemsMap) {
    itemsSummary.push({
      name,
      totalQuantity: data.quantity,
      totalValue: data.value,
    });
  }
  itemsSummary.sort((a, b) => b.totalValue - a.totalValue);
  
  const totalValue = db.equipmentCases.reduce((sum, c) => sum + c.totalValue, 0);
  
  return {
    success: true,
    message: `库存报告：共 ${db.equipmentCases.length} 个设备箱，总价值 ¥${totalValue.toFixed(2)}`,
    data: {
      totalCases: db.equipmentCases.length,
      totalValue,
      byStatus,
      byCity,
      itemsSummary,
    },
  };
}

export function getAuditReport(): ServiceResult<AuditReport> {
  const db = getDB();
  
  const activeBorrowCount = db.borrowRecords.filter(r => r.status === 'active').length;
  const completedBorrowCount = db.borrowRecords.filter(r => r.status === 'completed').length;
  const unresolvedDamageCount = db.damageRecords.filter(d => !d.isResolved).length;
  const inProgressRepairCount = db.repairRecords.filter(r => r.status === 'in_progress').length;
  const pendingCompensationCount = db.compensationActions.filter(a => a.status === 'pending').length;
  const permanentFailedCompensationCount = db.compensationActions.filter(a => a.status === 'failed_permanent').length;
  const activeToursCount = db.tourManifests.filter(t => t.status === 'in_progress').length;
  const completedToursCount = db.tourManifests.filter(t => t.status === 'completed').length;
  
  return {
    success: true,
    message: `审计报告：` +
      `${db.borrowRecords.length} 条借出记录（${activeBorrowCount} 个进行中，${completedBorrowCount} 个已完成），` +
      `${db.damageRecords.length} 条损坏记录（${unresolvedDamageCount} 个未解决），` +
      `${db.repairRecords.length} 条维修记录（${inProgressRepairCount} 个进行中），` +
      `${db.compensationActions.length} 个补偿动作（${pendingCompensationCount} 个待执行，${permanentFailedCompensationCount} 个永久失败），` +
      `${db.tourManifests.length} 个巡演清单（${activeToursCount} 个进行中）`,
    data: {
      totalBorrowRecords: db.borrowRecords.length,
      activeBorrowCount,
      completedBorrowCount,
      totalDamageRecords: db.damageRecords.length,
      unresolvedDamageCount,
      totalRepairRecords: db.repairRecords.length,
      inProgressRepairCount,
      totalCompensationActions: db.compensationActions.length,
      pendingCompensationCount,
      permanentFailedCompensationCount,
      totalTours: db.tourManifests.length,
      activeToursCount,
      completedToursCount,
    },
  };
}

export function getCaseHistoryReport(caseIdentifier: string): ServiceResult<CaseHistoryReport> {
  const db = getDB();
  
  let caseObj = db.equipmentCases.find(c => c.id === caseIdentifier);
  if (!caseObj) {
    caseObj = db.equipmentCases.find(c => c.caseNumber === caseIdentifier);
  }
  
  if (!caseObj) {
    return {
      success: false,
      message: `未找到标识为「${caseIdentifier}」的设备箱`,
    };
  }
  
  const currentCityResult = getCityByIdentifier(caseObj.currentCityId);
  
  const borrowHistory: CaseHistoryReport['borrowHistory'] = db.borrowRecords
    .filter(r => r.caseId === caseObj!.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map(r => {
      const fromCityResult = getCityByIdentifier(r.fromCityId);
      const toCityResult = r.toCityId ? getCityByIdentifier(r.toCityId) : null;
      return {
        id: r.id,
        fromCity: fromCityResult.success ? fromCityResult.data!.name : '未知城市',
        toCity: toCityResult && toCityResult.success ? toCityResult.data!.name : '同城',
        borrowedBy: r.borrowedBy,
        borrowTime: r.createdAt,
        returnTime: r.actualReturnTime,
        status: r.status === 'active' ? '进行中' : r.status === 'completed' ? '已完成' : r.status,
      };
    });
  
  const damageHistory: CaseHistoryReport['damageHistory'] = db.damageRecords
    .filter(d => d.caseId === caseObj!.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map(d => {
      const cityResult = getCityByIdentifier(d.cityId);
      return {
        id: d.id,
        city: cityResult.success ? cityResult.data!.name : '未知城市',
        severity: getDamageSeverityLabel(d.severity),
        reportedBy: d.reportedBy,
        reportedTime: d.damageTime,
        isResolved: d.isResolved,
      };
    });
  
  const repairHistory: CaseHistoryReport['repairHistory'] = db.repairRecords
    .filter(r => r.caseId === caseObj!.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map(r => ({
      id: r.id,
      startedBy: r.startedBy,
      startTime: r.startTime,
      endTime: r.endTime,
      status: r.status === 'in_progress' ? '进行中' : r.status === 'completed' ? '已完成' : r.status,
      cost: r.cost,
    }));
  
  return {
    success: true,
    message: `设备箱「${caseObj.caseNumber}」历史记录：共 ${borrowHistory.length} 次借出，${damageHistory.length} 次损坏报告，${repairHistory.length} 次维修`,
    data: {
      caseNumber: caseObj.caseNumber,
      caseName: caseObj.name,
      currentStatus: getCaseStatusLabel(caseObj.status),
      currentCity: currentCityResult.success ? currentCityResult.data!.name : '未知城市',
      totalValue: caseObj.totalValue,
      borrowHistory,
      damageHistory,
      repairHistory,
    },
  };
}
