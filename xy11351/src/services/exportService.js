const ExcelJS = require('exceljs');
const { Parser } = require('json2csv');
const { PrintBatch, LabRecord, QualityOrder, ReworkRecord } = require('../models');
const { Op } = require('sequelize');

class ExportService {
  async exportToExcel(params = {}) {
    const { 
      batchNo, 
      productName, 
      responsible, 
      status, 
      exceptionType, 
      startDate, 
      endDate 
    } = params;

    const where = {};
    
    if (batchNo) where.batchNo = { [Op.like]: `%${batchNo}%` };
    if (productName) where.productName = { [Op.like]: `%${productName}%` };
    if (responsible) where.responsible = responsible;
    if (status) where.status = status;
    if (exceptionType) where.exceptionType = { [Op.like]: `%${exceptionType}%` };
    if (startDate && endDate) where.printDate = { [Op.between]: [startDate, endDate] };

    const batches = await PrintBatch.findAll({
      where,
      include: [
        { model: LabRecord, as: 'labRecords' },
        { model: QualityOrder, as: 'qualityOrders' },
        { model: ReworkRecord, as: 'reworkRecords' }
      ],
      order: [['printDate', 'DESC']]
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = '印刷品控系统';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('质检汇总报告');

    worksheet.columns = [
      { header: '批次号', key: 'batchNo', width: 20 },
      { header: '产品名称', key: 'productName', width: 30 },
      { header: '纸张批次', key: 'paperBatchNo', width: 20 },
      { header: '印刷日期', key: 'printDate', width: 15 },
      { header: '数量', key: 'quantity', width: 10 },
      { header: '状态', key: 'status', width: 12 },
      { header: '质量等级', key: 'qualityLevel', width: 12 },
      { header: '负责人', key: 'responsible', width: 12 },
      { header: '检测人', key: 'checker', width: 12 },
      { header: '复核人', key: 'reviewer', width: 12 },
      { header: '检测点数', key: 'labCount', width: 12 },
      { header: '合格率(%)', key: 'passRate', width: 12 },
      { header: '最大色差ΔE', key: 'maxDeltaE', width: 15 },
      { header: '返工次数', key: 'reworkCount', width: 12 },
      { header: '异常类型', key: 'exceptionType', width: 30 },
      { header: '质检单号', key: 'qualityOrderNo', width: 20 }
    ];

    worksheet.getRow(1).font = { bold: true, size: 12 };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    for (const batch of batches) {
      const labRecords = batch.labRecords || [];
      const totalCount = labRecords.length;
      const passedCount = labRecords.filter(r => r.isPassed).length;
      const passRate = totalCount > 0 ? (passedCount / totalCount * 100).toFixed(2) : 0;
      const maxDeltaE = totalCount > 0 ? Math.max(...labRecords.map(r => parseFloat(r.deltaE))) : 0;

      const qualityOrder = batch.qualityOrders && batch.qualityOrders[0];

      worksheet.addRow({
        batchNo: batch.batchNo,
        productName: batch.productName,
        paperBatchNo: batch.paperBatchNo || '',
        printDate: batch.printDate ? batch.printDate.toISOString().slice(0, 10) : '',
        quantity: batch.quantity || 0,
        status: this.translateStatus(batch.status),
        qualityLevel: this.translateQualityLevel(batch.qualityLevel),
        responsible: batch.responsible || '',
        checker: batch.checker || '',
        reviewer: batch.reviewer || '',
        labCount: totalCount,
        passRate: passRate,
        maxDeltaE: maxDeltaE.toFixed(2),
        reworkCount: batch.reworkCount || 0,
        exceptionType: batch.exceptionType || '',
        qualityOrderNo: qualityOrder ? qualityOrder.orderNo : ''
      });
    }

    if (batches.length > 0) {
      const labWorksheet = workbook.addWorksheet('Lab检测明细');
      
      labWorksheet.columns = [
        { header: '印刷批次', key: 'printBatchNo', width: 20 },
        { header: '采样点', key: 'samplePoint', width: 15 },
        { header: '实测L', key: 'measureL', width: 12 },
        { header: '实测A', key: 'measureA', width: 12 },
        { header: '实测B', key: 'measureB', width: 12 },
        { header: '目标L', key: 'targetL', width: 12 },
        { header: '目标A', key: 'targetA', width: 12 },
        { header: '目标B', key: 'targetB', width: 12 },
        { header: 'ΔL', key: 'deltaL', width: 12 },
        { header: 'ΔA', key: 'deltaA', width: 12 },
        { header: 'ΔB', key: 'deltaB', width: 12 },
        { header: 'ΔE', key: 'deltaE', width: 12 },
        { header: '是否合格', key: 'isPassed', width: 10 },
        { header: '测量时间', key: 'measureTime', width: 20 },
        { header: '测量人', key: 'measuredBy', width: 12 }
      ];

      labWorksheet.getRow(1).font = { bold: true, size: 12 };
      labWorksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };

      for (const batch of batches) {
        for (const record of batch.labRecords || []) {
          labWorksheet.addRow({
            printBatchNo: batch.batchNo,
            samplePoint: record.samplePoint || '',
            measureL: record.measureL,
            measureA: record.measureA,
            measureB: record.measureB,
            targetL: batch.targetL || '',
            targetA: batch.targetA || '',
            targetB: batch.targetB || '',
            deltaL: record.deltaL,
            deltaA: record.deltaA,
            deltaB: record.deltaB,
            deltaE: record.deltaE,
            isPassed: record.isPassed ? '是' : '否',
            measureTime: record.measureTime ? record.measureTime.toISOString().slice(0, 16) : '',
            measuredBy: record.measuredBy || ''
          });
        }
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  }

  async exportToCsv(params = {}) {
    const data = await this.getExportData(params);
    
    const fields = [
      'batchNo', 'productName', 'paperBatchNo', 'printDate',
      'quantity', 'status', 'qualityLevel', 'responsible',
      'checker', 'reviewer', 'labCount', 'passRate',
      'maxDeltaE', 'reworkCount', 'exceptionType', 'qualityOrderNo'
    ];

    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(data);
    return csv;
  }

  async getExportData(params = {}) {
    const { 
      batchNo, 
      productName, 
      responsible, 
      status, 
      exceptionType, 
      startDate, 
      endDate 
    } = params;

    const where = {};
    
    if (batchNo) where.batchNo = { [Op.like]: `%${batchNo}%` };
    if (productName) where.productName = { [Op.like]: `%${productName}%` };
    if (responsible) where.responsible = responsible;
    if (status) where.status = status;
    if (exceptionType) where.exceptionType = { [Op.like]: `%${exceptionType}%` };
    if (startDate && endDate) where.printDate = { [Op.between]: [startDate, endDate] };

    const batches = await PrintBatch.findAll({
      where,
      include: [
        { model: LabRecord, as: 'labRecords' },
        { model: QualityOrder, as: 'qualityOrders' }
      ],
      order: [['printDate', 'DESC']]
    });

    return batches.map(batch => {
      const labRecords = batch.labRecords || [];
      const totalCount = labRecords.length;
      const passedCount = labRecords.filter(r => r.isPassed).length;
      const passRate = totalCount > 0 ? (passedCount / totalCount * 100).toFixed(2) : 0;
      const maxDeltaE = totalCount > 0 ? Math.max(...labRecords.map(r => parseFloat(r.deltaE))) : 0;
      const qualityOrder = batch.qualityOrders && batch.qualityOrders[0];

      return {
        batchNo: batch.batchNo,
        productName: batch.productName,
        paperBatchNo: batch.paperBatchNo || '',
        printDate: batch.printDate ? batch.printDate.toISOString().slice(0, 10) : '',
        quantity: batch.quantity || 0,
        status: this.translateStatus(batch.status),
        qualityLevel: this.translateQualityLevel(batch.qualityLevel),
        responsible: batch.responsible || '',
        checker: batch.checker || '',
        reviewer: batch.reviewer || '',
        labCount: totalCount,
        passRate: passRate,
        maxDeltaE: maxDeltaE.toFixed(2),
        reworkCount: batch.reworkCount || 0,
        exceptionType: batch.exceptionType || '',
        qualityOrderNo: qualityOrder ? qualityOrder.orderNo : ''
      };
    });
  }

  translateStatus(status) {
    const map = {
      'pending': '待检测',
      'checked': '已检测',
      'approved': '已复核通过',
      'rejected': '已驳回',
      'reworked': '已返工'
    };
    return map[status] || status;
  }

  translateQualityLevel(level) {
    const map = {
      'excellent': '优秀',
      'good': '良好',
      'acceptable': '合格',
      'unacceptable': '不合格'
    };
    return map[level] || level;
  }
}

module.exports = new ExportService();
