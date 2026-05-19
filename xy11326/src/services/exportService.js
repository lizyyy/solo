const fs = require('fs');
const path = require('path');
const { Parser } = require('json2csv');
const XLSX = require('xlsx');
const config = require('../config');
const BillingRecord = require('../models/BillingRecord');
const WorkRecord = require('../models/WorkRecord');
const Operator = require('../models/Operator');
const { maskSensitiveFields } = require('../utils/security');

const ensureExportDir = () => {
  if (!fs.existsSync(config.exports.dir)) {
    fs.mkdirSync(config.exports.dir, { recursive: true });
  }
};

const exportBillingRecordsToCsv = async (filters = {}) => {
  ensureExportDir();
  
  const billingData = await BillingRecord.findAll(filters);
  
  const maskedData = maskSensitiveFields(billingData);
  
  const fields = [
    { label: '账单ID', value: 'id' },
    { label: '作业记录号', value: 'recordNo' },
    { label: '机手姓名', value: 'operatorName' },
    { label: '拖拉机牌号', value: 'tractorPlate' },
    { label: '小时费', value: 'hoursFee' },
    { label: '亩计费', value: 'acresFee' },
    { label: '油费', value: 'fuelFee' },
    { label: '服务费', value: 'serviceFee' },
    { label: '总金额', value: 'totalAmount' },
    { label: '计费日期', value: 'billingDate' },
    { label: '支付状态', value: 'status' },
    { label: '备注', value: 'remarks' }
  ];
  
  const json2csvParser = new Parser({ fields });
  const csv = json2csvParser.parse(maskedData);
  
  const fileName = `billing_export_${new Date().toISOString().slice(0, 10)}.csv`;
  const filePath = path.join(config.exports.dir, fileName);
  
  fs.writeFileSync(filePath, '\ufeff' + csv, 'utf8');
  
  return { filePath, fileName, recordCount: billingData.length };
};

const exportBillingRecordsToExcel = async (filters = {}) => {
  ensureExportDir();
  
  const billingData = await BillingRecord.findAll(filters);
  
  const maskedData = maskSensitiveFields(billingData);
  
  const exportData = maskedData.map(record => ({
    '账单ID': record.id,
    '作业记录号': record.recordNo,
    '机手姓名': record.operatorName,
    '拖拉机牌号': record.tractorPlate,
    '小时费': record.hoursFee,
    '亩计费': record.acresFee,
    '油费': record.fuelFee,
    '服务费': record.serviceFee,
    '总金额': record.totalAmount,
    '计费日期': record.billingDate,
    '支付状态': record.status,
    '备注': record.remarks
  }));
  
  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '账单记录');
  
  const fileName = `billing_export_${new Date().toISOString().slice(0, 10)}.xlsx`;
  const filePath = path.join(config.exports.dir, fileName);
  
  XLSX.writeFile(workbook, filePath);
  
  return { filePath, fileName, recordCount: billingData.length };
};

const exportWorkRecords = async (filters = {}, format = 'xlsx') => {
  ensureExportDir();
  
  const workRecords = await WorkRecord.findAll(filters);
  
  const exportData = workRecords.map(record => ({
    '记录编号': record.recordNo,
    '机手姓名': record.operatorName,
    '拖拉机牌号': record.tractorPlate,
    '作业日期': record.workDate,
    '作业类型': record.workType,
    '地块名称': record.fieldName,
    '作业时长(小时)': record.hours,
    '作业亩数': record.acres,
    '油耗(升)': record.fuelConsumption,
    '状态': record.status,
    '备注': record.remarks
  }));
  
  let fileName, filePath;
  
  if (format === 'csv') {
    const fields = Object.keys(exportData[0] || {});
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(exportData);
    
    fileName = `work_records_${new Date().toISOString().slice(0, 10)}.csv`;
    filePath = path.join(config.exports.dir, fileName);
    
    fs.writeFileSync(filePath, '\ufeff' + csv, 'utf8');
  } else {
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '作业记录');
    
    fileName = `work_records_${new Date().toISOString().slice(0, 10)}.xlsx`;
    filePath = path.join(config.exports.dir, fileName);
    
    XLSX.writeFile(workbook, filePath);
  }
  
  return { filePath, fileName, recordCount: workRecords.length };
};

const exportOperatorSummary = async (filters = {}) => {
  ensureExportDir();
  
  const operators = await Operator.findAll();
  const summaryData = [];
  
  for (const operator of operators) {
    const billingRecords = await BillingRecord.findAll({ ...filters });
    const operatorBills = billingRecords.filter(b => b.operatorName === operator.name);
    
    const totalAmount = operatorBills.reduce((sum, b) => sum + b.totalAmount, 0);
    const paidAmount = operatorBills.filter(b => b.status === 'paid').reduce((sum, b) => sum + b.totalAmount, 0);
    
    summaryData.push({
      '机手姓名': operator.name,
      '联系电话': operator.phone,
      '账单数量': operatorBills.length,
      '总金额': totalAmount,
      '已付金额': paidAmount,
      '未付金额': totalAmount - paidAmount
    });
  }
  
  const maskedSummary = maskSensitiveFields(summaryData);
  
  const worksheet = XLSX.utils.json_to_sheet(maskedSummary);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '机手汇总');
  
  const fileName = `operator_summary_${new Date().toISOString().slice(0, 10)}.xlsx`;
  const filePath = path.join(config.exports.dir, fileName);
  
  XLSX.writeFile(workbook, filePath);
  
  return { filePath, fileName, recordCount: summaryData.length };
};

module.exports = {
  exportBillingRecordsToCsv,
  exportBillingRecordsToExcel,
  exportWorkRecords,
  exportOperatorSummary
};
