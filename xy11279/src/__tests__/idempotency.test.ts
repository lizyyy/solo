import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import { initDatabase, getVehicles, getTasks, getChargers, getShiftByDateAndType } from '../db';
import { importVehiclesFromCSV, importChargersFromJSON, importTasksFromCSV } from '../import';
import { createShiftSchedule } from '../services/shiftService';
import { ShiftType } from '../types';

describe('幂等性测试', () => {
  const testDbPath = path.join(__dirname, 'test-db.json');

  beforeEach(async () => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    await initDatabase(testDbPath);
  });

  afterEach(() => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('数据导入', () => {
    it('重复导入车辆CSV应该保持结果稳定', async () => {
      const csvPath = path.join(__dirname, '../../examples/vehicles.csv');
      
      const result1 = await importVehiclesFromCSV(csvPath);
      const vehicles1 = await getVehicles();
      
      const result2 = await importVehiclesFromCSV(csvPath);
      const vehicles2 = await getVehicles();
      
      expect(vehicles1.length).toBe(vehicles2.length);
      expect(result2.imported).toBe(0);
      expect(result2.skipped).toBe(0);
      expect(result2.failed).toBe(0);
      
      vehicles1.forEach((v, i) => {
        expect(v.plateNumber).toBe(vehicles2[i].plateNumber);
        expect(v.batteryLevel).toBe(vehicles2[i].batteryLevel);
      });
    });

    it('重复导入充电桩JSON应该保持结果稳定', async () => {
      const jsonPath = path.join(__dirname, '../../examples/chargers.json');
      
      const result1 = await importChargersFromJSON(jsonPath);
      const chargers1 = await getChargers();
      
      const result2 = await importChargersFromJSON(jsonPath);
      const chargers2 = await getChargers();
      
      expect(chargers1.length).toBe(chargers2.length);
      expect(result2.imported).toBe(0);
    });

    it('重复导入任务CSV应该保持结果稳定', async () => {
      const csvPath = path.join(__dirname, '../../examples/tasks.csv');
      
      const result1 = await importTasksFromCSV(csvPath);
      const tasks1 = await getTasks();
      
      const result2 = await importTasksFromCSV(csvPath);
      const tasks2 = await getTasks();
      
      expect(tasks1.length).toBe(tasks2.length);
      expect(result2.imported).toBe(0);
    });
  });

  describe('排班', () => {
    it('同一日期同一班次只能创建一次', async () => {
      const csvPath = path.join(__dirname, '../../examples/vehicles.csv');
      await importVehiclesFromCSV(csvPath);
      const tasksCsvPath = path.join(__dirname, '../../examples/tasks.csv');
      await importTasksFromCSV(tasksCsvPath);
      
      const shift1 = await createShiftSchedule({
        date: '2024-01-01',
        shiftType: ShiftType.NIGHT,
        startTime: '22:00',
        endTime: '06:00',
        operatorIds: []
      });
      
      await expect(
        createShiftSchedule({
          date: '2024-01-01',
          shiftType: ShiftType.NIGHT,
          startTime: '22:00',
          endTime: '06:00',
          operatorIds: []
        })
      ).rejects.toThrow();
      
      const shift = await getShiftByDateAndType('2024-01-01', ShiftType.NIGHT);
      expect(shift?.id).toBe(shift1.id);
    });
  });
});
