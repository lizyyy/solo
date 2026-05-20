import * as csvParser from 'csv-parser';
import { Readable } from 'stream';
import { v4 as uuidv4 } from 'uuid';
import {
  PassengerLostItem,
  DriverTurnedInItem,
  WarehouseItem,
  RecordSource,
  ImportResult
} from '../types';

export class CsvImporter {
  async importPassengerLostItems(csvContent: string): Promise<ImportResult<PassengerLostItem>> {
    const results: PassengerLostItem[] = [];
    const errors: string[] = [];
    let rowIndex = 0;

    return new Promise((resolve) => {
      const stream = Readable.from(csvContent);
      stream
        .pipe(csvParser())
        .on('data', (data) => {
          rowIndex++;
          try {
            const item = this.parsePassengerRow(data, rowIndex);
            if (item) {
              results.push(item);
            }
          } catch (error) {
            errors.push(`第 ${rowIndex} 行: ${(error as Error).message}`);
          }
        })
        .on('end', () => {
          resolve({
            success: errors.length === 0,
            data: results,
            errors,
            totalCount: rowIndex,
            validCount: results.length,
            invalidCount: errors.length
          });
        });
    });
  }

  async importDriverTurnedInItems(csvContent: string): Promise<ImportResult<DriverTurnedInItem>> {
    const results: DriverTurnedInItem[] = [];
    const errors: string[] = [];
    let rowIndex = 0;

    return new Promise((resolve) => {
      const stream = Readable.from(csvContent);
      stream
        .pipe(csvParser())
        .on('data', (data) => {
          rowIndex++;
          try {
            const item = this.parseDriverRow(data, rowIndex);
            if (item) {
              results.push(item);
            }
          } catch (error) {
            errors.push(`第 ${rowIndex} 行: ${(error as Error).message}`);
          }
        })
        .on('end', () => {
          resolve({
            success: errors.length === 0,
            data: results,
            errors,
            totalCount: rowIndex,
            validCount: results.length,
            invalidCount: errors.length
          });
        });
    });
  }

  async importWarehouseItems(csvContent: string): Promise<ImportResult<WarehouseItem>> {
    const results: WarehouseItem[] = [];
    const errors: string[] = [];
    let rowIndex = 0;

    return new Promise((resolve) => {
      const stream = Readable.from(csvContent);
      stream
        .pipe(csvParser())
        .on('data', (data) => {
          rowIndex++;
          try {
            const item = this.parseWarehouseRow(data, rowIndex);
            if (item) {
              results.push(item);
            }
          } catch (error) {
            errors.push(`第 ${rowIndex} 行: ${(error as Error).message}`);
          }
        })
        .on('end', () => {
          resolve({
            success: errors.length === 0,
            data: results,
            errors,
            totalCount: rowIndex,
            validCount: results.length,
            invalidCount: errors.length
          });
        });
    });
  }

  private parsePassengerRow(data: any, rowIndex: number): PassengerLostItem | null {
    const requiredFields = ['reportDate', 'passengerName', 'passengerPhone', 'itemName', 'itemDescription', 'itemCategory', 'routeNumber', 'lostDate', 'lostLocation'];
    const missingFields = requiredFields.filter(field => !data[field]);

    if (missingFields.length > 0) {
      throw new Error(`缺少必填字段: ${missingFields.join(', ')}`);
    }

    return {
      id: uuidv4(),
      reportDate: this.normalizeDate(data.reportDate),
      reportTime: data.reportTime || '',
      passengerName: data.passengerName,
      passengerPhone: data.passengerPhone,
      itemName: data.itemName,
      itemDescription: data.itemDescription,
      itemCategory: data.itemCategory,
      itemColor: data.itemColor || '',
      itemBrand: data.itemBrand || '',
      routeNumber: data.routeNumber,
      busNumber: data.busNumber || '',
      lostDate: this.normalizeDate(data.lostDate),
      lostTime: data.lostTime || '',
      lostLocation: data.lostLocation,
      destination: data.destination || '',
      seatLocation: data.seatLocation || '',
      remarks: data.remarks || '',
      source: RecordSource.PASSENGER
    };
  }

  private parseDriverRow(data: any, rowIndex: number): DriverTurnedInItem | null {
    const requiredFields = ['turnInDate', 'driverName', 'driverId', 'routeNumber', 'busNumber', 'itemName', 'itemDescription', 'itemCategory', 'foundDate', 'foundLocation'];
    const missingFields = requiredFields.filter(field => !data[field]);

    if (missingFields.length > 0) {
      throw new Error(`缺少必填字段: ${missingFields.join(', ')}`);
    }

    const imageIds = data.imageIds ? data.imageIds.split(',').map((id: string) => id.trim()).filter(Boolean) : [];

    return {
      id: uuidv4(),
      turnInDate: this.normalizeDate(data.turnInDate),
      turnInTime: data.turnInTime || '',
      driverName: data.driverName,
      driverId: data.driverId,
      routeNumber: data.routeNumber,
      busNumber: data.busNumber,
      itemName: data.itemName,
      itemDescription: data.itemDescription,
      itemCategory: data.itemCategory,
      itemColor: data.itemColor || '',
      itemBrand: data.itemBrand || '',
      foundDate: this.normalizeDate(data.foundDate),
      foundTime: data.foundTime || '',
      foundLocation: data.foundLocation,
      bagNumber: data.bagNumber || '',
      remarks: data.remarks || '',
      imageIds,
      source: RecordSource.DRIVER
    };
  }

  private parseWarehouseRow(data: any, rowIndex: number): WarehouseItem | null {
    const requiredFields = ['receiptDate', 'warehouseStaff', 'itemName', 'itemDescription', 'itemCategory', 'storageLocation'];
    const missingFields = requiredFields.filter(field => !data[field]);

    if (missingFields.length > 0) {
      throw new Error(`缺少必填字段: ${missingFields.join(', ')}`);
    }

    const imageIds = data.imageIds ? data.imageIds.split(',').map((id: string) => id.trim()).filter(Boolean) : [];

    return {
      id: uuidv4(),
      receiptDate: this.normalizeDate(data.receiptDate),
      receiptTime: data.receiptTime || '',
      warehouseStaff: data.warehouseStaff,
      itemName: data.itemName,
      itemDescription: data.itemDescription,
      itemCategory: data.itemCategory,
      itemColor: data.itemColor || '',
      itemBrand: data.itemBrand || '',
      storageLocation: data.storageLocation,
      shelfNumber: data.shelfNumber || '',
      bagNumber: data.bagNumber || '',
      driverTurnInId: data.driverTurnInId || '',
      imageIds,
      remarks: data.remarks || '',
      source: RecordSource.WAREHOUSE
    };
  }

  private normalizeDate(dateStr: string): string {
    if (!dateStr) return '';
    const formats = [
      /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/,
      /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/,
      /^(\d{4})(\d{2})(\d{2})$/
    ];

    for (const format of formats) {
      const match = dateStr.match(format);
      if (match) {
        let year, month, day;
        if (format === formats[0]) {
          [, year, month, day] = match;
        } else if (format === formats[1]) {
          [, month, day, year] = match;
        } else {
          year = match[1];
          month = match[2];
          day = match[3];
        }
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
    }
    return dateStr;
  }
}
