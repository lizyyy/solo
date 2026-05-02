import csvParser from 'csv-parser';
import { Readable } from 'stream';
import { Store, Pool, SampleRecord, DeviceCalibration, SampleType, User, UserRole } from '../types';
import { createStore, getStoreById } from '../storage/storeRepository';
import { createPool, getPoolById } from '../storage/poolRepository';
import { createSampleRecord } from '../storage/sampleRecordRepository';
import { createDeviceCalibration } from '../storage/deviceCalibrationRepository';
import { checkThreshold } from '../rules/validationRules';

export interface ImportResult<T> {
  success: boolean;
  imported: T[];
  errors: { row: number; error: string }[];
  warnings: { row: number; warning: string }[];
  totalRows: number;
}

export async function importStoresFromCsv(
  csvContent: string,
  user: User
): Promise<ImportResult<Store>> {
  return new Promise((resolve) => {
    const result: ImportResult<Store> = {
      success: true,
      imported: [],
      errors: [],
      warnings: [],
      totalRows: 0
    };

    const stream = Readable.from(csvContent);
    let rowNumber = 0;

    stream
      .pipe(csvParser())
      .on('data', (row: Record<string, string>) => {
        rowNumber++;
        result.totalRows++;

        try {
          const name = row.name?.trim() || row['门店名称']?.trim();
          const address = row.address?.trim() || row['地址']?.trim();
          const contactPerson = row.contactPerson?.trim() || row['联系人']?.trim();
          const contactPhone = row.contactPhone?.trim() || row['联系电话']?.trim();

          if (!name) {
            result.errors.push({ row: rowNumber, error: '缺少门店名称' });
            result.success = false;
            return;
          }

          if (!address) {
            result.errors.push({ row: rowNumber, error: '缺少地址' });
            result.success = false;
            return;
          }

          if (!contactPerson) {
            result.errors.push({ row: rowNumber, error: '缺少联系人' });
            result.success = false;
            return;
          }

          if (!contactPhone) {
            result.errors.push({ row: rowNumber, error: '缺少联系电话' });
            result.success = false;
            return;
          }

          const store = createStore(name, address, contactPerson, contactPhone, user);
          result.imported.push(store);
        } catch (error: any) {
          result.errors.push({ row: rowNumber, error: error.message || '导入失败' });
          result.success = false;
        }
      })
      .on('end', () => {
        resolve(result);
      })
      .on('error', (error: any) => {
        result.errors.push({ row: 0, error: error.message || 'CSV解析失败' });
        result.success = false;
        resolve(result);
      });
  });
}

export async function importPoolsFromCsv(
  csvContent: string,
  user: User
): Promise<ImportResult<Pool>> {
  return new Promise((resolve) => {
    const result: ImportResult<Pool> = {
      success: true,
      imported: [],
      errors: [],
      warnings: [],
      totalRows: 0
    };

    const stream = Readable.from(csvContent);
    let rowNumber = 0;

    stream
      .pipe(csvParser())
      .on('data', (row: Record<string, string>) => {
        rowNumber++;
        result.totalRows++;

        try {
          const storeId = row.storeId?.trim() || row['门店ID']?.trim();
          const name = row.name?.trim() || row['泳池名称']?.trim();
          const type = row.type?.trim() || row['泳池类型']?.trim() || '标准池';
          const volumeStr = row.volume?.trim() || row['容积']?.trim();

          if (!storeId) {
            result.errors.push({ row: rowNumber, error: '缺少门店ID' });
            result.success = false;
            return;
          }

          const store = getStoreById(storeId);
          if (!store) {
            result.errors.push({ row: rowNumber, error: `门店ID ${storeId} 不存在` });
            result.success = false;
            return;
          }

          if (!name) {
            result.errors.push({ row: rowNumber, error: '缺少泳池名称' });
            result.success = false;
            return;
          }

          const volume = parseFloat(volumeStr);
          if (isNaN(volume) || volume <= 0) {
            result.errors.push({ row: rowNumber, error: '容积必须是大于0的数字' });
            result.success = false;
            return;
          }

          const pool = createPool(storeId, name, type, volume, user);
          result.imported.push(pool);
        } catch (error: any) {
          result.errors.push({ row: rowNumber, error: error.message || '导入失败' });
          result.success = false;
        }
      })
      .on('end', () => {
        resolve(result);
      })
      .on('error', (error: any) => {
        result.errors.push({ row: 0, error: error.message || 'CSV解析失败' });
        result.success = false;
        resolve(result);
      });
  });
}

export async function importSampleRecordsFromCsv(
  csvContent: string,
  user: User
): Promise<ImportResult<SampleRecord>> {
  return new Promise((resolve) => {
    const result: ImportResult<SampleRecord> = {
      success: true,
      imported: [],
      errors: [],
      warnings: [],
      totalRows: 0
    };

    const stream = Readable.from(csvContent);
    let rowNumber = 0;

    stream
      .pipe(csvParser())
      .on('data', (row: Record<string, string>) => {
        rowNumber++;
        result.totalRows++;

        try {
          const storeId = row.storeId?.trim() || row['门店ID']?.trim();
          const poolId = row.poolId?.trim() || row['泳池ID']?.trim();
          const sampleTypeStr = row.sampleType?.trim() || row['采样类型']?.trim();
          const valueStr = row.value?.trim() || row['数值']?.trim();
          const unit = row.unit?.trim() || row['单位']?.trim();
          const sampleTime = row.sampleTime?.trim() || row['采样时间']?.trim() || new Date().toISOString();
          const recordedBy = row.recordedBy?.trim() || row['记录人']?.trim() || user.username;
          const deviceCalibrationId = row.deviceCalibrationId?.trim() || row['设备校准ID']?.trim();

          if (!storeId) {
            result.errors.push({ row: rowNumber, error: '缺少门店ID' });
            result.success = false;
            return;
          }

          if (!poolId) {
            result.errors.push({ row: rowNumber, error: '缺少泳池ID' });
            result.success = false;
            return;
          }

          const pool = getPoolById(poolId);
          if (!pool) {
            result.errors.push({ row: rowNumber, error: `泳池ID ${poolId} 不存在` });
            result.success = false;
            return;
          }

          if (!sampleTypeStr) {
            result.errors.push({ row: rowNumber, error: '缺少采样类型' });
            result.success = false;
            return;
          }

          const sampleTypeMap: Record<string, SampleType> = {
            'chlorine': SampleType.CHLORINE,
            '余氯': SampleType.CHLORINE,
            'ph': SampleType.PH,
            'pH': SampleType.PH,
            '酸碱度': SampleType.PH,
            'turbidity': SampleType.TURBIDITY,
            '浊度': SampleType.TURBIDITY
          };

          const sampleType = sampleTypeMap[sampleTypeStr.toLowerCase()];
          if (!sampleType) {
            result.errors.push({ row: rowNumber, error: `无效的采样类型: ${sampleTypeStr}` });
            result.success = false;
            return;
          }

          const value = parseFloat(valueStr);
          if (isNaN(value)) {
            result.errors.push({ row: rowNumber, error: '数值必须是数字' });
            result.success = false;
            return;
          }

          const thresholdResult = checkThreshold(sampleType, value);
          if (!thresholdResult.valid) {
            thresholdResult.errors.forEach(e => {
              result.warnings.push({ row: rowNumber, warning: e });
            });
          }

          const sampleRecord = createSampleRecord(
            storeId,
            poolId,
            sampleType,
            value,
            unit,
            sampleTime,
            recordedBy,
            deviceCalibrationId || undefined,
            user
          );

          result.imported.push(sampleRecord);
        } catch (error: any) {
          result.errors.push({ row: rowNumber, error: error.message || '导入失败' });
          result.success = false;
        }
      })
      .on('end', () => {
        resolve(result);
      })
      .on('error', (error: any) => {
        result.errors.push({ row: 0, error: error.message || 'CSV解析失败' });
        result.success = false;
        resolve(result);
      });
  });
}

export async function importDeviceCalibrationsFromCsv(
  csvContent: string,
  user: User
): Promise<ImportResult<DeviceCalibration>> {
  return new Promise((resolve) => {
    const result: ImportResult<DeviceCalibration> = {
      success: true,
      imported: [],
      errors: [],
      warnings: [],
      totalRows: 0
    };

    const stream = Readable.from(csvContent);
    let rowNumber = 0;

    stream
      .pipe(csvParser())
      .on('data', (row: Record<string, string>) => {
        rowNumber++;
        result.totalRows++;

        try {
          const storeId = row.storeId?.trim() || row['门店ID']?.trim();
          const deviceName = row.deviceName?.trim() || row['设备名称']?.trim();
          const deviceType = row.deviceType?.trim() || row['设备类型']?.trim();
          const serialNumber = row.serialNumber?.trim() || row['序列号']?.trim();
          const calibrationDate = row.calibrationDate?.trim() || row['校准日期']?.trim();
          const validUntil = row.validUntil?.trim() || row['有效期至']?.trim();
          const calibratedBy = row.calibratedBy?.trim() || row['校准人']?.trim() || user.username;
          const certificateUrl = row.certificateUrl?.trim() || row['证书链接']?.trim();

          if (!storeId) {
            result.errors.push({ row: rowNumber, error: '缺少门店ID' });
            result.success = false;
            return;
          }

          const store = getStoreById(storeId);
          if (!store) {
            result.errors.push({ row: rowNumber, error: `门店ID ${storeId} 不存在` });
            result.success = false;
            return;
          }

          if (!deviceName) {
            result.errors.push({ row: rowNumber, error: '缺少设备名称' });
            result.success = false;
            return;
          }

          if (!deviceType) {
            result.errors.push({ row: rowNumber, error: '缺少设备类型' });
            result.success = false;
            return;
          }

          if (!serialNumber) {
            result.errors.push({ row: rowNumber, error: '缺少序列号' });
            result.success = false;
            return;
          }

          if (!calibrationDate) {
            result.errors.push({ row: rowNumber, error: '缺少校准日期' });
            result.success = false;
            return;
          }

          if (!validUntil) {
            result.errors.push({ row: rowNumber, error: '缺少有效期至' });
            result.success = false;
            return;
          }

          const calibration = createDeviceCalibration(
            storeId,
            deviceName,
            deviceType,
            serialNumber,
            calibrationDate,
            validUntil,
            calibratedBy,
            certificateUrl || undefined,
            user
          );

          result.imported.push(calibration);
        } catch (error: any) {
          result.errors.push({ row: rowNumber, error: error.message || '导入失败' });
          result.success = false;
        }
      })
      .on('end', () => {
        resolve(result);
      })
      .on('error', (error: any) => {
        result.errors.push({ row: 0, error: error.message || 'CSV解析失败' });
        result.success = false;
        resolve(result);
      });
  });
}
