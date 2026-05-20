import * as fs from 'fs';
import csv from 'csv-parser';
import { KeyBorrowRecord, VehicleInfo, ViolationRecord, ImportResult } from '../types';
import { store } from '../models/Store';

export class ImportService {
  async importBorrowRecordsFromCSV(filePath: string): Promise<ImportResult<KeyBorrowRecord>> {
    const results: any[] = [];
    const errors: { row: number; message: string }[] = [];
    let rowNumber = 0;

    return new Promise((resolve) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data: any) => {
          rowNumber++;
          try {
            const parsed = this.parseBorrowRecord(data);
            results.push({ ...parsed, row: rowNumber });
          } catch (error: any) {
            errors.push({ row: rowNumber, message: error.message });
          }
        })
        .on('end', () => {
          const imported: KeyBorrowRecord[] = [];
          
          results.forEach((item) => {
            try {
              const record = store.addBorrowRecord({
                recordId: item.recordId || `BR-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                vehicleId: item.vehicleId,
                vehiclePlate: item.vehiclePlate,
                borrower: item.borrower,
                borrowerDepartment: item.borrowerDepartment,
                borrowTime: item.borrowTime,
                expectedReturnTime: item.expectedReturnTime,
                actualReturnTime: item.actualReturnTime,
                borrowMileage: item.borrowMileage,
                returnMileage: item.returnMileage,
                fuelCardId: item.fuelCardId,
                fuelBalanceBefore: item.fuelBalanceBefore,
                fuelBalanceAfter: item.fuelBalanceAfter,
                status: item.status || 'pending',
                remarks: item.remarks
              });
              imported.push(record);
            } catch (error: any) {
              errors.push({ row: item.row, message: `保存失败: ${error.message}` });
            }
          });

          resolve({
            success: errors.length === 0,
            total: rowNumber,
            imported: imported.length,
            failed: errors.length,
            errors,
            data: imported
          });
        });
    });
  }

  async importVehiclesFromJSON(filePath: string): Promise<ImportResult<VehicleInfo>> {
    const errors: { row: number; message: string }[] = [];
    const imported: VehicleInfo[] = [];

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);
      const vehicles = Array.isArray(data) ? data : [data];

      vehicles.forEach((item, index) => {
        try {
          const vehicle = store.addVehicle({
            vehicleId: item.vehicleId || item.id || `VH-${Date.now()}-${index}`,
            plateNumber: item.plateNumber || item.plate || item.vehiclePlate,
            brand: item.brand || item.make,
            model: item.model,
            color: item.color || '未知',
            vin: item.vin || item.frameNumber || '',
            currentMileage: Number(item.currentMileage || item.mileage || 0),
            fuelCardId: item.fuelCardId || item.oilCardId || '',
            fuelCardBalance: Number(item.fuelCardBalance || item.oilCardBalance || 0),
            keyCount: Number(item.keyCount || item.keyNumber || 2),
            status: item.status || 'available',
            assignedSalesperson: item.assignedSalesperson || item.salesperson,
            purchaseDate: item.purchaseDate ? new Date(item.purchaseDate) : new Date(),
            remarks: item.remarks
          });
          imported.push(vehicle);
        } catch (error: any) {
          errors.push({ row: index + 1, message: `解析失败: ${error.message}` });
        }
      });

      return {
        success: errors.length === 0,
        total: vehicles.length,
        imported: imported.length,
        failed: errors.length,
        errors,
        data: imported
      };
    } catch (error: any) {
      errors.push({ row: 0, message: `文件读取失败: ${error.message}` });
      return {
        success: false,
        total: 0,
        imported: 0,
        failed: 1,
        errors,
        data: []
      };
    }
  }

  async importViolationsFromJSON(filePath: string): Promise<ImportResult<ViolationRecord>> {
    const errors: { row: number; message: string }[] = [];
    const imported: ViolationRecord[] = [];

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);
      const violations = Array.isArray(data) ? data : [data];

      violations.forEach((item, index) => {
        try {
          const violation = store.addViolation({
            violationId: item.violationId || item.id || `VL-${Date.now()}-${index}`,
            vehiclePlate: item.vehiclePlate || item.plateNumber || item.plate,
            vehicleId: item.vehicleId,
            violationTime: new Date(item.violationTime || item.time),
            violationType: item.violationType || item.type,
            violationLocation: item.violationLocation || item.location,
            points: Number(item.points || item.deductPoints || 0),
            fineAmount: Number(item.fineAmount || item.fine || 0),
            status: item.status || 'unprocessed',
            driverName: item.driverName || item.driver,
            driverId: item.driverId,
            processedTime: item.processedTime ? new Date(item.processedTime) : undefined,
            remarks: item.remarks,
            source: item.source || 'traffic_bureau'
          });
          imported.push(violation);
        } catch (error: any) {
          errors.push({ row: index + 1, message: `解析失败: ${error.message}` });
        }
      });

      return {
        success: errors.length === 0,
        total: violations.length,
        imported: imported.length,
        failed: errors.length,
        errors,
        data: imported
      };
    } catch (error: any) {
      errors.push({ row: 0, message: `文件读取失败: ${error.message}` });
      return {
        success: false,
        total: 0,
        imported: 0,
        failed: 1,
        errors,
        data: []
      };
    }
  }

  private parseBorrowRecord(data: any): Omit<KeyBorrowRecord, 'id' | 'createdAt' | 'updatedAt'> {
    const required = ['vehiclePlate', 'borrower', 'borrowTime', 'expectedReturnTime'];
    const missing = required.filter(field => !data[field]);
    
    if (missing.length > 0) {
      throw new Error(`缺少必填字段: ${missing.join(', ')}`);
    }

    return {
      recordId: data.recordId || data.id || '',
      vehicleId: data.vehicleId || '',
      vehiclePlate: data.vehiclePlate,
      borrower: data.borrower,
      borrowerDepartment: data.borrowerDepartment || data.department || '销售部',
      borrowTime: new Date(data.borrowTime),
      expectedReturnTime: new Date(data.expectedReturnTime),
      actualReturnTime: data.actualReturnTime ? new Date(data.actualReturnTime) : undefined,
      borrowMileage: Number(data.borrowMileage || data.startMileage || 0),
      returnMileage: data.returnMileage ? Number(data.returnMileage) : undefined,
      fuelCardId: data.fuelCardId || data.oilCardId,
      fuelBalanceBefore: Number(data.fuelBalanceBefore || data.oilBalanceBefore || 0),
      fuelBalanceAfter: data.fuelBalanceAfter ? Number(data.fuelBalanceAfter) : undefined,
      status: (data.status as any) || 'pending',
      remarks: data.remarks
    };
  }
}

export const importService = new ImportService();
