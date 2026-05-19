import * as fs from 'fs';
import * as path from 'path';
import csv from 'csv-parser';
import { Vehicle, Charger, Task, ImportResult, ImportError, VehicleStatus, ChargerStatus, TaskStatus } from '../types';
import { addVehicle, addCharger, addTask, getVehicleByPlate, getChargerById, getTaskByOrderNumber, checkImportDuplicate, recordImport, generateHash, updateVehicle, updateCharger, updateTask } from '../db';

function validateVehicle(data: Record<string, string>): { valid: boolean; errors: string[]; vehicle?: Omit<Vehicle, 'id' | 'lastUpdate'> } {
  const errors: string[] = [];
  
  if (!data.plateNumber) {
    errors.push('车牌号不能为空');
  }
  
  const batteryLevel = parseFloat(data.batteryLevel);
  if (isNaN(batteryLevel) || batteryLevel < 0 || batteryLevel > 100) {
    errors.push('电量必须是 0-100 之间的数字');
  }
  
  const status = data.status as VehicleStatus;
  if (!Object.values(VehicleStatus).includes(status)) {
    errors.push(`状态必须是 ${Object.values(VehicleStatus).join(', ')} 之一`);
  }
  
  if (errors.length > 0) {
    return { valid: false, errors };
  }
  
  return {
    valid: true,
    errors: [],
    vehicle: {
      plateNumber: data.plateNumber,
      batteryLevel,
      status,
      currentChargerId: data.currentChargerId || undefined,
      currentTaskId: data.currentTaskId || undefined,
      operatorId: data.operatorId || undefined
    }
  };
}

function validateCharger(data: Record<string, string>): { valid: boolean; errors: string[]; charger?: Omit<Charger, 'id'> } {
  const errors: string[] = [];
  
  if (!data.name) {
    errors.push('充电桩名称不能为空');
  }
  
  const power = parseInt(data.power);
  if (isNaN(power) || power <= 0) {
    errors.push('功率必须是正整数');
  }
  
  const status = data.status as ChargerStatus;
  if (!Object.values(ChargerStatus).includes(status)) {
    errors.push(`状态必须是 ${Object.values(ChargerStatus).join(', ')} 之一`);
  }
  
  if (!data.location) {
    errors.push('位置不能为空');
  }
  
  if (errors.length > 0) {
    return { valid: false, errors };
  }
  
  return {
    valid: true,
    errors: [],
    charger: {
      name: data.name,
      status,
      currentVehicleId: data.currentVehicleId || undefined,
      power,
      location: data.location
    }
  };
}

function validateTask(data: Record<string, string>): { valid: boolean; errors: string[]; task?: Omit<Task, 'id' | 'createdAt'> } {
  const errors: string[] = [];
  
  if (!data.orderNumber) {
    errors.push('订单号不能为空');
  }
  
  if (!data.description) {
    errors.push('任务描述不能为空');
  }
  
  const priority = parseInt(data.priority);
  if (isNaN(priority) || priority < 1 || priority > 5) {
    errors.push('优先级必须是 1-5 之间的整数');
  }
  
  const estimatedDuration = parseInt(data.estimatedDuration);
  if (isNaN(estimatedDuration) || estimatedDuration <= 0) {
    errors.push('预计时长必须是正整数（分钟）');
  }
  
  const requiredBattery = parseInt(data.requiredBattery);
  if (isNaN(requiredBattery) || requiredBattery < 0 || requiredBattery > 100) {
    errors.push('所需电量必须是 0-100 之间的整数');
  }
  
  const status = (data.status as TaskStatus) || TaskStatus.PENDING;
  if (!Object.values(TaskStatus).includes(status)) {
    errors.push(`状态必须是 ${Object.values(TaskStatus).join(', ')} 之一`);
  }
  
  if (errors.length > 0) {
    return { valid: false, errors };
  }
  
  return {
    valid: true,
    errors: [],
    task: {
      orderNumber: data.orderNumber,
      description: data.description,
      priority,
      estimatedDuration,
      requiredBattery,
      status,
      assignedVehicleId: data.assignedVehicleId || undefined,
      assignedOperatorId: data.assignedOperatorId || undefined,
      shiftId: data.shiftId || undefined
    }
  };
}

function generateSuggestion(field: string): string {
  const suggestions: Record<string, string> = {
    plateNumber: '请检查车牌号格式，如：京A12345',
    batteryLevel: '请输入 0-100 之间的数字，如：75',
    status: '有效状态：available, in_use, charging, maintenance',
    name: '请输入有效的充电桩名称，如：CHARGER-01',
    power: '请输入正整数，单位：kW，如：100',
    location: '请输入位置描述，如：A区-01号位',
    orderNumber: '请输入有效的订单号，如：ORD-20240101-001',
    description: '请简要描述任务内容',
    priority: '优先级范围：1（最低）- 5（最高）',
    estimatedDuration: '请输入预计时长（分钟），如：60',
    requiredBattery: '所需电量范围：0-100'
  };
  return suggestions[field] || '请检查数据格式是否正确';
}

export async function importVehiclesFromCSV(filePath: string): Promise<ImportResult<Vehicle>> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const hash = generateHash(content);
  
  if (await checkImportDuplicate('vehicles', hash)) {
    return {
      success: true,
      imported: 0,
      skipped: 0,
      failed: 0,
      data: [],
      errors: []
    };
  }
  
  return new Promise((resolve) => {
    const results: Vehicle[] = [];
    const errors: ImportError[] = [];
    let rowNumber = 0;
    let imported = 0;
    let skipped = 0;
    
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', async (data: Record<string, string>) => {
        rowNumber++;
        const validation = validateVehicle(data);
        
        if (!validation.valid || !validation.vehicle) {
          errors.push({
            rowNumber,
            rawData: data,
            error: validation.errors.join('; '),
            suggestion: generateSuggestion(validation.errors[0]?.split(' ')[0] || '')
          });
          return;
        }
        
        const existing = await getVehicleByPlate(validation.vehicle.plateNumber);
        if (existing) {
          await updateVehicle(existing.id, validation.vehicle);
          skipped++;
          results.push({ ...existing, ...validation.vehicle });
        } else {
          const vehicle = await addVehicle(validation.vehicle);
          imported++;
          results.push(vehicle);
        }
      })
      .on('end', async () => {
        await recordImport('vehicles', path.basename(filePath), results.length, hash);
        resolve({
          success: errors.length === 0,
          imported,
          skipped,
          failed: errors.length,
          data: results,
          errors
        });
      })
      .on('error', (error) => {
        errors.push({
          rowNumber: 0,
          rawData: {},
          error: `文件读取失败: ${error.message}`,
          suggestion: '请检查文件路径和权限'
        });
        resolve({
          success: false,
          imported: 0,
          skipped: 0,
          failed: 1,
          data: [],
          errors
        });
      });
  });
}

export async function importChargersFromJSON(filePath: string): Promise<ImportResult<Charger>> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const hash = generateHash(content);
  
  if (await checkImportDuplicate('chargers', hash)) {
    return {
      success: true,
      imported: 0,
      skipped: 0,
      failed: 0,
      data: [],
      errors: []
    };
  }
  
  const results: Charger[] = [];
  const errors: ImportError[] = [];
  let imported = 0;
  let skipped = 0;
  
  try {
    const data = JSON.parse(content);
    const chargers = Array.isArray(data) ? data : [data];
    
    for (let i = 0; i < chargers.length; i++) {
      const chargerData = chargers[i];
      const validation = validateCharger(chargerData);
      
      if (!validation.valid || !validation.charger) {
        errors.push({
          rowNumber: i + 1,
          rawData: chargerData,
          error: validation.errors.join('; '),
          suggestion: generateSuggestion(validation.errors[0]?.split(' ')[0] || '')
        });
        continue;
      }
      
      const existing = await getChargerById(chargerData.id);
      if (existing) {
        await updateCharger(existing.id, validation.charger);
        skipped++;
        results.push({ ...existing, ...validation.charger });
      } else {
        const charger = await addCharger(validation.charger);
        imported++;
        results.push(charger);
      }
    }
    
    await recordImport('chargers', path.basename(filePath), results.length, hash);
    return {
      success: errors.length === 0,
      imported,
      skipped,
      failed: errors.length,
      data: results,
      errors
    };
  } catch (error: any) {
    errors.push({
      rowNumber: 0,
      rawData: {},
      error: `JSON 解析失败: ${error.message}`,
      suggestion: '请检查 JSON 格式是否正确'
    });
    return {
      success: false,
      imported: 0,
      skipped: 0,
      failed: errors.length,
      data: [],
      errors
    };
  }
}

export async function importTasksFromCSV(filePath: string): Promise<ImportResult<Task>> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const hash = generateHash(content);
  
  if (await checkImportDuplicate('tasks', hash)) {
    return {
      success: true,
      imported: 0,
      skipped: 0,
      failed: 0,
      data: [],
      errors: []
    };
  }
  
  return new Promise((resolve) => {
    const results: Task[] = [];
    const errors: ImportError[] = [];
    let rowNumber = 0;
    let imported = 0;
    let skipped = 0;
    
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', async (data: Record<string, string>) => {
        rowNumber++;
        const validation = validateTask(data);
        
        if (!validation.valid || !validation.task) {
          errors.push({
            rowNumber,
            rawData: data,
            error: validation.errors.join('; '),
            suggestion: generateSuggestion(validation.errors[0]?.split(' ')[0] || '')
          });
          return;
        }
        
        const existing = await getTaskByOrderNumber(validation.task.orderNumber);
        if (existing) {
          await updateTask(existing.id, validation.task);
          skipped++;
          results.push({ ...existing, ...validation.task });
        } else {
          const task = await addTask(validation.task);
          imported++;
          results.push(task);
        }
      })
      .on('end', async () => {
        await recordImport('tasks', path.basename(filePath), results.length, hash);
        resolve({
          success: errors.length === 0,
          imported,
          skipped,
          failed: errors.length,
          data: results,
          errors
        });
      })
      .on('error', (error) => {
        errors.push({
          rowNumber: 0,
          rawData: {},
          error: `文件读取失败: ${error.message}`,
          suggestion: '请检查文件路径和权限'
        });
        resolve({
          success: false,
          imported: 0,
          skipped: 0,
          failed: 1,
          data: [],
          errors
        });
      });
  });
}
