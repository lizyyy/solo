import * as weighingDao from '../dao/weighingDao';
import * as priceDao from '../dao/priceDao';
import * as settlementDao from '../dao/settlementDao';
import { WeighingRecord, WeightVerification, ManualCorrection } from '../types';
import { createExceptionRecord } from '../dao/settlementDao';

export const createWeighingRecord = async (data: Omit<WeighingRecord, 'record_no'>): Promise<{ id: number; record_no: string }> => {
  try {
    if (data.gross_weight <= data.tare_weight) {
      throw new Error('毛重必须大于皮重');
    }

    const recordNo = `W${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const netWeight = data.gross_weight - data.tare_weight;

    const id = await weighingDao.createWeighingRecord({
      ...data,
      record_no: recordNo,
      net_weight: netWeight,
      status: 'pending'
    });

    return { id, record_no: recordNo };
  } catch (error: any) {
    await createExceptionRecord({
      type: 'CREATE_WEIGHING_ERROR',
      original_input: JSON.stringify(data),
      error_message: error.message
    });
    throw error;
  }
};

export const verifyWeight = async (recordId: number, verificationData: Omit<WeightVerification, 'id'>): Promise<void> => {
  try {
    const record = await weighingDao.getWeighingRecordById(recordId);
    if (!record) {
      throw new Error('称重记录不存在');
    }

    if (record.status !== 'pending') {
      throw new Error('只有待确认的记录可以复核');
    }

    const weightDiff = Math.abs(verificationData.gross_weight - record.gross_weight);
    if (weightDiff > 0.5) {
      await createExceptionRecord({
        record_no: record.record_no,
        type: 'WEIGHT_DISCREPANCY',
        original_input: JSON.stringify({ record, verification: verificationData }),
        error_message: `毛重差异过大: ${weightDiff}kg`
      });
      throw new Error(`毛重差异过大(${weightDiff}kg)，请人工确认`);
    }

    const tareDiff = Math.abs(verificationData.tare_weight - record.tare_weight);
    if (tareDiff > 0.2) {
      await createExceptionRecord({
        record_no: record.record_no,
        type: 'WEIGHT_DISCREPANCY',
        original_input: JSON.stringify({ record, verification: verificationData }),
        error_message: `皮重差异过大: ${tareDiff}kg`
      });
      throw new Error(`皮重差异过大(${tareDiff}kg)，请人工确认`);
    }

    await weighingDao.createWeightVerification(verificationData);
    await weighingDao.updateWeighingRecordStatus(recordId, 'verified', {
      confirmed_time: new Date().toISOString()
    });
  } catch (error: any) {
    if (!error.message.includes('差异过大')) {
      await createExceptionRecord({
        type: 'VERIFICATION_ERROR',
        original_input: JSON.stringify({ recordId, verificationData }),
        error_message: error.message
      });
    }
    throw error;
  }
};

export const applyPrice = async (recordId: number): Promise<void> => {
  try {
    const record = await weighingDao.getWeighingRecordById(recordId);
    if (!record) {
      throw new Error('称重记录不存在');
    }

    if (record.status !== 'verified') {
      throw new Error('只有已复核的记录可以录入价格');
    }

    const currentDate = record.weigh_time || new Date().toISOString();
    const priceVersion = await priceDao.getCurrentPrice(record.category_id, currentDate);
    
    if (!priceVersion) {
      throw new Error('该品类暂无有效价格');
    }

    const deductionRatio = await priceDao.getCurrentDeductionRatio(record.category_id);
    const finalDeductionRatio = deductionRatio?.ratio || 0;

    await weighingDao.updateWeighingRecordStatus(recordId, 'priced', {
      price_version_id: priceVersion.id,
      deduction_ratio: finalDeductionRatio
    });
  } catch (error: any) {
    await createExceptionRecord({
      type: 'APPLY_PRICE_ERROR',
      original_input: JSON.stringify({ recordId }),
      error_message: error.message
    });
    throw error;
  }
};

export const applyManualCorrection = async (recordId: number, correction: Omit<ManualCorrection, 'id' | 'weighing_record_id'>): Promise<void> => {
  try {
    const record = await weighingDao.getWeighingRecordById(recordId);
    if (!record) {
      throw new Error('称重记录不存在');
    }

    if (record.status === 'settled') {
      throw new Error('已结算的记录不能修改');
    }

    const oldValue = (record as any)[correction.field_name];

    await weighingDao.createManualCorrection({
      weighing_record_id: recordId,
      field_name: correction.field_name,
      old_value: String(oldValue),
      new_value: correction.new_value,
      reason: correction.reason,
      operator: correction.operator
    });

    if (correction.field_name === 'gross_weight' || correction.field_name === 'tare_weight') {
      const updateData: Partial<WeighingRecord> = {};
      if (correction.field_name === 'gross_weight') {
        updateData.gross_weight = parseFloat(correction.new_value || '0');
        updateData.tare_weight = record.tare_weight;
      } else {
        updateData.gross_weight = record.gross_weight;
        updateData.tare_weight = parseFloat(correction.new_value || '0');
      }
      updateData.net_weight = updateData.gross_weight! - updateData.tare_weight!;
      await weighingDao.updateWeighingRecord(recordId, updateData);
    }
  } catch (error: any) {
    await createExceptionRecord({
      type: 'MANUAL_CORRECTION_ERROR',
      original_input: JSON.stringify({ recordId, correction }),
      error_message: error.message
    });
    throw error;
  }
};

export const calculateSettlementAmount = async (recordId: number): Promise<{ netWeight: number; unitPrice: number; deductionRatio: number; finalWeight: number; amount: number }> => {
  const record = await weighingDao.getWeighingRecordById(recordId);
  if (!record) {
    throw new Error('称重记录不存在');
  }

  if (record.status !== 'priced' && record.status !== 'settled') {
    throw new Error('请先录入价格');
  }

  const priceVersion = await priceDao.getCurrentPrice(record.category_id, record.weigh_time || new Date().toISOString());
  if (!priceVersion) {
    throw new Error('价格信息不存在');
  }

  const netWeight = record.net_weight || (record.gross_weight - record.tare_weight);
  const deductionRatio = record.deduction_ratio || 0;
  const finalWeight = netWeight * (1 - deductionRatio);
  const amount = finalWeight * priceVersion.price;

  return {
    netWeight,
    unitPrice: priceVersion.price,
    deductionRatio,
    finalWeight,
    amount
  };
};
