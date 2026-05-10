import { v4 as uuidv4 } from 'uuid';
import { CaseItem, EquipmentCase, ServiceResult } from '../types';
import { getDB, updateDB } from '../storage';
import { getCityByIdentifier } from './cityService';

interface CreateCaseItemInput {
  name: string;
  quantity: number;
  unitValue: number;
  serialNumber?: string;
  condition?: 'new' | 'good' | 'fair' | 'poor';
}

interface CreateCaseInput {
  caseNumber: string;
  name: string;
  description?: string;
  cityIdentifier: string;
  items: CreateCaseItemInput[];
}

export function createCase(input: CreateCaseInput): ServiceResult<EquipmentCase> {
  const cityResult = getCityByIdentifier(input.cityIdentifier);
  if (!cityResult.success) {
    return { success: false, message: cityResult.message };
  }
  
  const city = cityResult.data!;
  
  const db = getDB();
  const existingCase = db.equipmentCases.find(c => c.caseNumber === input.caseNumber);
  if (existingCase) {
    return {
      success: false,
      message: `设备箱编号「${input.caseNumber}」已存在，请使用其他编号`,
    };
  }
  
  if (!input.items || input.items.length === 0) {
    return {
      success: false,
      message: '设备箱必须包含至少一个设备项',
    };
  }
  
  const items: CaseItem[] = input.items.map(item => ({
    id: uuidv4(),
    name: item.name,
    quantity: item.quantity,
    unitValue: item.unitValue,
    serialNumber: item.serialNumber,
    condition: item.condition || 'good',
  }));
  
  const totalValue = items.reduce((sum, item) => sum + item.quantity * item.unitValue, 0);
  
  const now = new Date().toISOString();
  const caseObj: EquipmentCase = {
    id: uuidv4(),
    caseNumber: input.caseNumber,
    name: input.name,
    description: input.description,
    items,
    currentCityId: city.id,
    status: 'in_stock',
    totalValue,
    createdAt: now,
    updatedAt: now,
  };
  
  updateDB(d => ({
    ...d,
    equipmentCases: [...d.equipmentCases, caseObj],
  }));
  
  return {
    success: true,
    message: `设备箱「${caseObj.caseNumber}」已入库到「${city.name}」，共 ${items.length} 项设备，总值 ¥${totalValue.toFixed(2)}`,
    data: caseObj,
  };
}

export function getCaseByIdentifier(identifier: string): ServiceResult<EquipmentCase> {
  const db = getDB();
  
  let caseObj = db.equipmentCases.find(c => c.id === identifier);
  if (!caseObj) {
    caseObj = db.equipmentCases.find(c => c.caseNumber === identifier);
  }
  
  if (!caseObj) {
    return {
      success: false,
      message: `未找到标识为「${identifier}」的设备箱，请确认ID或箱号是否正确`,
    };
  }
  
  return {
    success: true,
    message: `找到设备箱「${caseObj.caseNumber}」`,
    data: caseObj,
  };
}

export function listCases(cityIdentifier?: string, statusFilter?: string): ServiceResult<EquipmentCase[]> {
  const db = getDB();
  let filtered = [...db.equipmentCases];
  
  if (cityIdentifier) {
    const cityResult = getCityByIdentifier(cityIdentifier);
    if (!cityResult.success) {
      return {
        success: false,
        message: cityResult.message,
        data: [],
      };
    }
    filtered = filtered.filter(c => c.currentCityId === cityResult.data!.id);
  }
  
  if (statusFilter) {
    filtered = filtered.filter(c => c.status === statusFilter);
  }
  
  filtered.sort((a, b) => a.caseNumber.localeCompare(b.caseNumber));
  
  const totalValue = filtered.reduce((sum, c) => sum + c.totalValue, 0);
  
  return {
    success: true,
    message: `共查询到 ${filtered.length} 个设备箱，设备总值 ¥${totalValue.toFixed(2)}`,
    data: filtered,
  };
}

export function updateCaseItems(
  caseIdentifier: string,
  items: CreateCaseItemInput[]
): ServiceResult<EquipmentCase> {
  const caseResult = getCaseByIdentifier(caseIdentifier);
  if (!caseResult.success) {
    return caseResult as ServiceResult<EquipmentCase>;
  }
  
  const caseObj = caseResult.data!;
  
  if (caseObj.status === 'lent_out') {
    return {
      success: false,
      message: `设备箱「${caseObj.caseNumber}」当前处于借出状态，无法修改箱内物品`,
    };
  }
  
  if (caseObj.status === 'under_repair') {
    return {
      success: false,
      message: `设备箱「${caseObj.caseNumber}」当前处于维修状态，无法修改箱内物品`,
    };
  }
  
  const newItems: CaseItem[] = items.map(item => ({
    id: uuidv4(),
    name: item.name,
    quantity: item.quantity,
    unitValue: item.unitValue,
    serialNumber: item.serialNumber,
    condition: item.condition || 'good',
  }));
  
  const totalValue = newItems.reduce((sum, item) => sum + item.quantity * item.unitValue, 0);
  
  updateDB(d => ({
    ...d,
    equipmentCases: d.equipmentCases.map(c =>
      c.id === caseObj.id
        ? {
            ...c,
            items: newItems,
            totalValue,
            updatedAt: new Date().toISOString(),
          }
        : c
    ),
  }));
  
  return {
    success: true,
    message: `设备箱「${caseObj.caseNumber}」物品已更新，共 ${newItems.length} 项，总值 ¥${totalValue.toFixed(2)}`,
    data: { ...caseObj, items: newItems, totalValue, updatedAt: new Date().toISOString() },
  };
}

export function getCaseStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    in_stock: '在库',
    in_transit: '运输中',
    lent_out: '已借出',
    under_repair: '维修中',
    lost: '已丢失',
    damaged: '已损坏',
  };
  return labels[status] || status;
}
