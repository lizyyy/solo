"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateSettlementAmount = exports.applyManualCorrection = exports.applyPrice = exports.verifyWeight = exports.createWeighingRecord = void 0;
const weighingDao = __importStar(require("../dao/weighingDao"));
const priceDao = __importStar(require("../dao/priceDao"));
const settlementDao_1 = require("../dao/settlementDao");
const createWeighingRecord = async (data) => {
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
    }
    catch (error) {
        await (0, settlementDao_1.createExceptionRecord)({
            type: 'CREATE_WEIGHING_ERROR',
            original_input: JSON.stringify(data),
            error_message: error.message
        });
        throw error;
    }
};
exports.createWeighingRecord = createWeighingRecord;
const verifyWeight = async (recordId, verificationData) => {
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
            await (0, settlementDao_1.createExceptionRecord)({
                record_no: record.record_no,
                type: 'WEIGHT_DISCREPANCY',
                original_input: JSON.stringify({ record, verification: verificationData }),
                error_message: `毛重差异过大: ${weightDiff}kg`
            });
            throw new Error(`毛重差异过大(${weightDiff}kg)，请人工确认`);
        }
        const tareDiff = Math.abs(verificationData.tare_weight - record.tare_weight);
        if (tareDiff > 0.2) {
            await (0, settlementDao_1.createExceptionRecord)({
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
    }
    catch (error) {
        if (!error.message.includes('差异过大')) {
            await (0, settlementDao_1.createExceptionRecord)({
                type: 'VERIFICATION_ERROR',
                original_input: JSON.stringify({ recordId, verificationData }),
                error_message: error.message
            });
        }
        throw error;
    }
};
exports.verifyWeight = verifyWeight;
const applyPrice = async (recordId) => {
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
    }
    catch (error) {
        await (0, settlementDao_1.createExceptionRecord)({
            type: 'APPLY_PRICE_ERROR',
            original_input: JSON.stringify({ recordId }),
            error_message: error.message
        });
        throw error;
    }
};
exports.applyPrice = applyPrice;
const applyManualCorrection = async (recordId, correction) => {
    try {
        const record = await weighingDao.getWeighingRecordById(recordId);
        if (!record) {
            throw new Error('称重记录不存在');
        }
        if (record.status === 'settled') {
            throw new Error('已结算的记录不能修改');
        }
        const oldValue = record[correction.field_name];
        await weighingDao.createManualCorrection({
            weighing_record_id: recordId,
            field_name: correction.field_name,
            old_value: String(oldValue),
            new_value: correction.new_value,
            reason: correction.reason,
            operator: correction.operator
        });
        if (correction.field_name === 'gross_weight' || correction.field_name === 'tare_weight') {
            const updateData = {};
            if (correction.field_name === 'gross_weight') {
                updateData.gross_weight = parseFloat(correction.new_value || '0');
                updateData.tare_weight = record.tare_weight;
            }
            else {
                updateData.gross_weight = record.gross_weight;
                updateData.tare_weight = parseFloat(correction.new_value || '0');
            }
            updateData.net_weight = updateData.gross_weight - updateData.tare_weight;
            await weighingDao.updateWeighingRecord(recordId, updateData);
        }
    }
    catch (error) {
        await (0, settlementDao_1.createExceptionRecord)({
            type: 'MANUAL_CORRECTION_ERROR',
            original_input: JSON.stringify({ recordId, correction }),
            error_message: error.message
        });
        throw error;
    }
};
exports.applyManualCorrection = applyManualCorrection;
const calculateSettlementAmount = async (recordId) => {
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
exports.calculateSettlementAmount = calculateSettlementAmount;
