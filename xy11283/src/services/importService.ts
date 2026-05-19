import csv from 'csv-parser';
import { Readable } from 'stream';
import { Medicine, InventoryBatch, DosageRule, BadRecord, ImportResult } from '../models';
import { createMedicine, getMedicineByCode, createInventoryBatch } from './inventoryService';
import { createDosageRule } from './dosageService';
import { createBadRecord } from './badRecordService';
import { createPrescription } from './prescriptionService';

export async function importMedicinesFromCsv(csvContent: string): Promise<ImportResult> {
  const results: Medicine[] = [];
  const badRecords: BadRecord[] = [];
  let rowNumber = 0;

  return new Promise((resolve) => {
    const stream = Readable.from(csvContent);
    
    stream
      .pipe(csv())
      .on('data', async (data: any) => {
        rowNumber++;
        try {
          const errors: string[] = [];
          const suggestions: string[] = [];

          if (!data.code || data.code.trim() === '') {
            errors.push('药品编码不能为空');
            suggestions.push('请填写药品编码，例如：MED001');
          }

          if (!data.name || data.name.trim() === '') {
            errors.push('药品名称不能为空');
            suggestions.push('请填写药品名称');
          }

          if (!data.unit || data.unit.trim() === '') {
            errors.push('单位不能为空');
            suggestions.push('请填写单位，例如：片、ml、mg');
          }

          if (errors.length > 0) {
            const badRecord = await createBadRecord({
              source_type: 'medicine_import',
              row_number: rowNumber,
              original_data: JSON.stringify(data),
              error_type: 'validation_error',
              error_message: errors.join('; '),
              suggestion: suggestions.join('; '),
              status: 'pending'
            });
            badRecords.push(badRecord);
            return;
          }

          const existing = await getMedicineByCode(data.code.trim());
          if (existing) {
            const badRecord = await createBadRecord({
              source_type: 'medicine_import',
              row_number: rowNumber,
              original_data: JSON.stringify(data),
              error_type: 'duplicate',
              error_message: `药品编码 ${data.code} 已存在`,
              suggestion: '请使用不同的编码，或更新现有药品',
              status: 'pending'
            });
            badRecords.push(badRecord);
            return;
          }

          const medicine = await createMedicine({
            code: data.code.trim(),
            name: data.name.trim(),
            generic_name: data.generic_name?.trim(),
            manufacturer: data.manufacturer?.trim(),
            specification: data.specification?.trim(),
            unit: data.unit.trim(),
            dosage_form: data.dosage_form?.trim()
          });
          results.push(medicine);
        } catch (error: any) {
          const badRecord = await createBadRecord({
            source_type: 'medicine_import',
            row_number: rowNumber,
            original_data: JSON.stringify(data),
            error_type: 'system_error',
            error_message: error.message || '未知错误',
            suggestion: '请检查数据格式',
            status: 'pending'
          });
          badRecords.push(badRecord);
        }
      })
      .on('end', () => {
        resolve({
          success: results.length,
          failed: badRecords.length,
          total: results.length + badRecords.length,
          badRecords
        });
      });
  });
}

export async function importInventoryFromCsv(csvContent: string): Promise<ImportResult> {
  const results: InventoryBatch[] = [];
  const badRecords: BadRecord[] = [];
  let rowNumber = 0;

  return new Promise((resolve) => {
    const stream = Readable.from(csvContent);
    
    stream
      .pipe(csv())
      .on('data', async (data: any) => {
        rowNumber++;
        try {
          const errors: string[] = [];
          const suggestions: string[] = [];

          if (!data.medicine_code || data.medicine_code.trim() === '') {
            errors.push('药品编码不能为空');
            suggestions.push('请填写药品编码');
          }

          if (!data.batch_number || data.batch_number.trim() === '') {
            errors.push('批次号不能为空');
            suggestions.push('请填写批次号，例如：B20240101');
          }

          const quantity = parseFloat(data.quantity);
          if (isNaN(quantity) || quantity <= 0) {
            errors.push('数量必须是大于0的数字');
            suggestions.push('请输入有效的数量，例如：100');
          }

          if (!data.unit || data.unit.trim() === '') {
            errors.push('单位不能为空');
            suggestions.push('请填写单位');
          }

          if (errors.length > 0) {
            const badRecord = await createBadRecord({
              source_type: 'inventory_import',
              row_number: rowNumber,
              original_data: JSON.stringify(data),
              error_type: 'validation_error',
              error_message: errors.join('; '),
              suggestion: suggestions.join('; '),
              status: 'pending'
            });
            badRecords.push(badRecord);
            return;
          }

          const medicine = await getMedicineByCode(data.medicine_code.trim());
          if (!medicine) {
            const badRecord = await createBadRecord({
              source_type: 'inventory_import',
              row_number: rowNumber,
              original_data: JSON.stringify(data),
              error_type: 'not_found',
              error_message: `药品编码 ${data.medicine_code} 不存在`,
              suggestion: '请先导入该药品信息',
              status: 'pending'
            });
            badRecords.push(badRecord);
            return;
          }

          const batch = await createInventoryBatch({
            medicine_id: medicine.id!,
            batch_number: data.batch_number.trim(),
            quantity: quantity,
            unit: data.unit.trim(),
            manufacture_date: data.manufacture_date?.trim(),
            expiry_date: data.expiry_date?.trim(),
            location: data.location?.trim(),
            status: 'active'
          });
          results.push(batch);
        } catch (error: any) {
          const badRecord = await createBadRecord({
            source_type: 'inventory_import',
            row_number: rowNumber,
            original_data: JSON.stringify(data),
            error_type: 'system_error',
            error_message: error.message || '未知错误',
            suggestion: '请检查数据格式',
            status: 'pending'
          });
          badRecords.push(badRecord);
        }
      })
      .on('end', () => {
        resolve({
          success: results.length,
          failed: badRecords.length,
          total: results.length + badRecords.length,
          badRecords
        });
      });
  });
}

export async function importDosageRulesFromCsv(csvContent: string): Promise<ImportResult> {
  const results: DosageRule[] = [];
  const badRecords: BadRecord[] = [];
  let rowNumber = 0;

  return new Promise((resolve) => {
    const stream = Readable.from(csvContent);
    
    stream
      .pipe(csv())
      .on('data', async (data: any) => {
        rowNumber++;
        try {
          const errors: string[] = [];
          const suggestions: string[] = [];

          if (!data.medicine_code || data.medicine_code.trim() === '') {
            errors.push('药品编码不能为空');
            suggestions.push('请填写药品编码');
          }

          if (!data.species || data.species.trim() === '') {
            errors.push('物种不能为空');
            suggestions.push('请填写物种，例如：狗、猫');
          }

          const minDosage = parseFloat(data.min_dosage);
          if (isNaN(minDosage) || minDosage <= 0) {
            errors.push('最小剂量必须是大于0的数字');
            suggestions.push('请输入有效的最小剂量');
          }

          const maxDosage = parseFloat(data.max_dosage);
          if (isNaN(maxDosage) || maxDosage <= 0) {
            errors.push('最大剂量必须是大于0的数字');
            suggestions.push('请输入有效的最大剂量');
          }

          if (!data.dosage_unit || data.dosage_unit.trim() === '') {
            errors.push('剂量单位不能为空');
            suggestions.push('请填写剂量单位，例如：mg/kg、ml');
          }

          if (errors.length > 0) {
            const badRecord = await createBadRecord({
              source_type: 'dosage_import',
              row_number: rowNumber,
              original_data: JSON.stringify(data),
              error_type: 'validation_error',
              error_message: errors.join('; '),
              suggestion: suggestions.join('; '),
              status: 'pending'
            });
            badRecords.push(badRecord);
            return;
          }

          const medicine = await getMedicineByCode(data.medicine_code.trim());
          if (!medicine) {
            const badRecord = await createBadRecord({
              source_type: 'dosage_import',
              row_number: rowNumber,
              original_data: JSON.stringify(data),
              error_type: 'not_found',
              error_message: `药品编码 ${data.medicine_code} 不存在`,
              suggestion: '请先导入该药品信息',
              status: 'pending'
            });
            badRecords.push(badRecord);
            return;
          }

          const rule = await createDosageRule({
            medicine_id: medicine.id!,
            species: data.species.trim(),
            min_weight: data.min_weight ? parseFloat(data.min_weight) : undefined,
            max_weight: data.max_weight ? parseFloat(data.max_weight) : undefined,
            min_dosage: minDosage,
            max_dosage: maxDosage,
            dosage_unit: data.dosage_unit.trim(),
            dosage_per_kg: data.dosage_per_kg ? parseFloat(data.dosage_per_kg) : undefined,
            frequency: data.frequency?.trim(),
            route: data.route?.trim(),
            notes: data.notes?.trim()
          });
          results.push(rule);
        } catch (error: any) {
          const badRecord = await createBadRecord({
            source_type: 'dosage_import',
            row_number: rowNumber,
            original_data: JSON.stringify(data),
            error_type: 'system_error',
            error_message: error.message || '未知错误',
            suggestion: '请检查数据格式',
            status: 'pending'
          });
          badRecords.push(badRecord);
        }
      })
      .on('end', () => {
        resolve({
          success: results.length,
          failed: badRecords.length,
          total: results.length + badRecords.length,
          badRecords
        });
      });
  });
}

export async function importPrescriptionsFromJson(jsonContent: string): Promise<ImportResult> {
  const badRecords: BadRecord[] = [];
  const successPrescriptions: any[] = [];
  let rowNumber = 0;

  try {
    const prescriptions = JSON.parse(jsonContent);

    if (!Array.isArray(prescriptions)) {
      throw new Error('JSON 数据必须是数组格式');
    }

    for (const presc of prescriptions) {
      rowNumber++;
      try {
        const errors: string[] = [];

        if (!presc.prescription_no) errors.push('处方号不能为空');
        if (!presc.patient_id) errors.push('患者ID不能为空');
        if (!presc.patient_name) errors.push('患者姓名不能为空');
        if (!presc.species) errors.push('物种不能为空');
        if (!presc.weight || presc.weight <= 0) errors.push('体重必须大于0');
        if (!presc.doctor_id) errors.push('医生ID不能为空');
        if (!presc.doctor_name) errors.push('医生姓名不能为空');
        if (!presc.items || !Array.isArray(presc.items) || presc.items.length === 0) {
          errors.push('处方必须包含至少一种药品');
        }

        if (errors.length > 0) {
          const badRecord = await createBadRecord({
            source_type: 'prescription_import',
            row_number: rowNumber,
            original_data: JSON.stringify(presc),
            error_type: 'validation_error',
            error_message: errors.join('; '),
            suggestion: '请检查处方信息',
            status: 'pending'
          });
          badRecords.push(badRecord);
          continue;
        }

        const result = await createPrescription(presc, presc.items);
        if (result.errors.length > 0) {
          const badRecord = await createBadRecord({
            source_type: 'prescription_import',
            row_number: rowNumber,
            original_data: JSON.stringify(presc),
            error_type: 'validation_warning',
            error_message: result.errors.join('; '),
            suggestion: '请检查药品剂量和库存',
            status: 'pending'
          });
          badRecords.push(badRecord);
        }
        successPrescriptions.push(result.prescription);
      } catch (error: any) {
        const badRecord = await createBadRecord({
          source_type: 'prescription_import',
          row_number: rowNumber,
          original_data: JSON.stringify(presc),
          error_type: 'system_error',
          error_message: error.message || '未知错误',
          suggestion: '请检查数据格式',
          status: 'pending'
        });
        badRecords.push(badRecord);
      }
    }

    return {
      success: successPrescriptions.length,
      failed: badRecords.length,
      total: successPrescriptions.length + badRecords.length,
      badRecords
    };
  } catch (error: any) {
    const badRecord = await createBadRecord({
      source_type: 'prescription_import',
      original_data: jsonContent.substring(0, 500),
      error_type: 'parse_error',
      error_message: error.message || 'JSON 解析错误',
      suggestion: '请检查 JSON 格式是否正确',
      status: 'pending'
    });
    badRecords.push(badRecord);

    return {
      success: 0,
      failed: 1,
      total: 1,
      badRecords
    };
  }
}
