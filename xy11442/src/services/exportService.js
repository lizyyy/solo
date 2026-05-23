const fs = require('fs');
const path = require('path');
const { Parser } = require('json2csv');
const logger = require('../config/logger');
const config = require('../config');
const { CompensationQueue, LossRecord, ImportBatch } = require('../models');
const { Op } = require('sequelize');

class ExportService {
  static ensureExportDir() {
    const exportDir = config.export.dir;
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }
    return exportDir;
  }

  static generateFileName(prefix) {
    const dateStr = new Date().toISOString().slice(0, 10);
    const random = Math.random().toString(36).substring(2, 8);
    return `${prefix}_${dateStr}_${random}.csv`;
  }

  static async exportQueueByStatus(status, options = {}) {
    logger.info(`导出队列数据，状态: ${status}`);

    const where = { status };
    if (options.jobType) where.jobType = options.jobType;
    if (options.supplierId) where.supplierId = options.supplierId;
    if (options.startDate || options.endDate) {
      where.createdAt = {};
      if (options.startDate) where.createdAt[Op.gte] = options.startDate;
      if (options.endDate) where.createdAt[Op.lte] = options.endDate;
    }

    const jobs = await CompensationQueue.findAll({
      where,
      include: [{ association: 'lossRecord' }],
      order: [['createdAt', 'DESC']],
    });

    const data = jobs.map(job => ({
      queueNo: job.queueNo,
      jobType: job.jobType,
      jobTypeName: this.getJobTypeName(job.jobType),
      status: job.status,
      statusName: this.getStatusName(job.status),
      lossNo: job.lossRecord?.lossNo || '',
      deliveryNo: job.deliveryNo || '',
      supplierId: job.supplierId || '',
      retryCount: job.retryCount,
      maxRetryCount: job.maxRetryCount,
      nextRetryAt: job.nextRetryAt ? job.nextRetryAt.toISOString() : '',
      lastError: job.lastError || '',
      lastErrorAt: job.lastErrorAt ? job.lastErrorAt.toISOString() : '',
      compensationAmount: job.compensationAmount || 0,
      compensatedAt: job.compensatedAt ? job.compensatedAt.toISOString() : '',
      handledBy: job.handledBy || '',
      handledAt: job.handledAt ? job.handledAt.toISOString() : '',
      handleNote: job.handleNote || '',
      externalReceiptId: job.externalReceiptId || '',
      createdAt: job.createdAt.toISOString(),
      closedBy: job.closedBy || '',
      closedAt: job.closedAt ? job.closedAt.toISOString() : '',
      closeReason: job.closeReason || '',
    }));

    const fields = [
      { label: '队列编号', value: 'queueNo' },
      { label: '任务类型', value: 'jobTypeName' },
      { label: '状态', value: 'statusName' },
      { label: '损耗单号', value: 'lossNo' },
      { label: '送货单号', value: 'deliveryNo' },
      { label: '供应商ID', value: 'supplierId' },
      { label: '重试次数', value: 'retryCount' },
      { label: '最大重试', value: 'maxRetryCount' },
      { label: '下次重试时间', value: 'nextRetryAt' },
      { label: '最后错误', value: 'lastError' },
      { label: '错误时间', value: 'lastErrorAt' },
      { label: '补偿金额', value: 'compensationAmount' },
      { label: '补偿时间', value: 'compensatedAt' },
      { label: '处理人', value: 'handledBy' },
      { label: '处理时间', value: 'handledAt' },
      { label: '处理备注', value: 'handleNote' },
      { label: '外部回执ID', value: 'externalReceiptId' },
      { label: '创建时间', value: 'createdAt' },
      { label: '关闭人', value: 'closedBy' },
      { label: '关闭时间', value: 'closedAt' },
      { label: '关闭原因', value: 'closeReason' },
    ];

    return this.writeCSV(data, fields, `queue_${status}`);
  }

  static async exportRetryable(params = {}) {
    logger.info('导出可重试任务');

    const where = {
      status: { [Op.in]: ['waiting_retry', 'pending', 'processing'] },
    };
    if (params.supplierId) where.supplierId = params.supplierId;

    const jobs = await CompensationQueue.findAll({
      where,
      include: [{ association: 'lossRecord' }],
      order: [['nextRetryAt', 'ASC']],
    });

    const data = jobs.map(job => ({
      queueNo: job.queueNo,
      jobType: this.getJobTypeName(job.jobType),
      status: this.getStatusName(job.status),
      lossNo: job.lossRecord?.lossNo || '',
      deliveryNo: job.deliveryNo || '',
      supplierId: job.supplierId || '',
      retryCount: job.retryCount,
      maxRetryCount: job.maxRetryCount,
      remainRetryCount: job.maxRetryCount - job.retryCount,
      nextRetryAt: job.nextRetryAt ? job.nextRetryAt.toISOString() : '',
      lastError: job.lastError || '',
      lossType: job.lossRecord?.lossType ? this.getLossTypeName(job.lossRecord.lossType) : '',
      lossAmount: job.lossRecord?.lossAmount || 0,
      createdAt: job.createdAt.toISOString(),
    }));

    const fields = [
      { label: '队列编号', value: 'queueNo' },
      { label: '任务类型', value: 'jobType' },
      { label: '状态', value: 'status' },
      { label: '损耗单号', value: 'lossNo' },
      { label: '送货单号', value: 'deliveryNo' },
      { label: '供应商ID', value: 'supplierId' },
      { label: '已重试', value: 'retryCount' },
      { label: '最大重试', value: 'maxRetryCount' },
      { label: '剩余重试', value: 'remainRetryCount' },
      { label: '下次重试', value: 'nextRetryAt' },
      { label: '错误信息', value: 'lastError' },
      { label: '损耗类型', value: 'lossType' },
      { label: '损耗金额', value: 'lossAmount' },
      { label: '创建时间', value: 'createdAt' },
    ];

    return this.writeCSV(data, fields, 'retryable_tasks');
  }

  static async exportDeadLetter(params = {}) {
    logger.info('导出死信（永久失败）任务');

    const where = {
      status: { [Op.in]: ['permanent_failed', 'waiting_manual'] },
    };
    if (params.supplierId) where.supplierId = params.supplierId;

    const jobs = await CompensationQueue.findAll({
      where,
      include: [{ association: 'lossRecord' }],
      order: [['lastErrorAt', 'DESC']],
    });

    const data = jobs.map(job => ({
      queueNo: job.queueNo,
      jobType: this.getJobTypeName(job.jobType),
      status: this.getStatusName(job.status),
      lossNo: job.lossRecord?.lossNo || '',
      deliveryNo: job.deliveryNo || '',
      supplierId: job.supplierId || '',
      retryCount: job.retryCount,
      maxRetryCount: job.maxRetryCount,
      lastError: job.lastError || '',
      lastErrorAt: job.lastErrorAt ? job.lastErrorAt.toISOString() : '',
      errorCount: (job.errorHistory || []).length,
      lossType: job.lossRecord?.lossType ? this.getLossTypeName(job.lossRecord.lossType) : '',
      lossAmount: job.lossRecord?.lossAmount || 0,
      handledBy: job.handledBy || '',
      handleNote: job.handleNote || '',
      createdAt: job.createdAt.toISOString(),
    }));

    const fields = [
      { label: '队列编号', value: 'queueNo' },
      { label: '任务类型', value: 'jobType' },
      { label: '状态', value: 'status' },
      { label: '损耗单号', value: 'lossNo' },
      { label: '送货单号', value: 'deliveryNo' },
      { label: '供应商ID', value: 'supplierId' },
      { label: '重试次数', value: 'retryCount' },
      { label: '最大重试', value: 'maxRetryCount' },
      { label: '最后错误', value: 'lastError' },
      { label: '错误时间', value: 'lastErrorAt' },
      { label: '错误次数', value: 'errorCount' },
      { label: '损耗类型', value: 'lossType' },
      { label: '损耗金额', value: 'lossAmount' },
      { label: '处理人', value: 'handledBy' },
      { label: '处理备注', value: 'handleNote' },
      { label: '创建时间', value: 'createdAt' },
    ];

    return this.writeCSV(data, fields, 'dead_letter_tasks');
  }

  static async exportLossRecords(params = {}) {
    logger.info('导出损耗记录');

    const where = {};
    if (params.lossType) where.lossType = params.lossType;
    if (params.status) where.status = params.status;
    if (params.isDuplicate !== undefined) where.isDuplicate = params.isDuplicate;
    if (params.supplierId) where.supplierId = params.supplierId;

    const records = await LossRecord.findAll({
      where,
      order: [['lossDate', 'DESC']],
    });

    const data = records.map(r => ({
      lossNo: r.lossNo,
      deliveryNo: r.deliveryNo || '',
      supplierId: r.supplierId,
      supplierName: r.supplierName,
      productId: r.productId,
      productName: r.productName,
      lossDate: r.lossDate.toISOString(),
      lossType: this.getLossTypeName(r.lossType),
      lossCategory: r.lossCategory || '',
      deliveryQuantity: r.deliveryQuantity || 0,
      actualWeight: r.actualWeight || 0,
      lossQuantity: r.lossQuantity,
      unit: r.unit,
      unitPrice: r.unitPrice || 0,
      lossAmount: r.lossAmount,
      isDuplicate: r.isDuplicate ? '是' : '否',
      duplicateSourceId: r.duplicateSourceId || '',
      sourceType: this.getSourceTypeName(r.sourceType),
      status: this.getLossStatusName(r.status),
      confirmedBy: r.confirmedBy || '',
      confirmedAt: r.confirmedAt ? r.confirmedAt.toISOString() : '',
      remark: r.remark || '',
      createdAt: r.createdAt.toISOString(),
    }));

    const fields = [
      { label: '损耗单号', value: 'lossNo' },
      { label: '送货单号', value: 'deliveryNo' },
      { label: '供应商ID', value: 'supplierId' },
      { label: '供应商名称', value: 'supplierName' },
      { label: '商品ID', value: 'productId' },
      { label: '商品名称', value: 'productName' },
      { label: '损耗日期', value: 'lossDate' },
      { label: '损耗类型', value: 'lossType' },
      { label: '损耗分类', value: 'lossCategory' },
      { label: '送货数量', value: 'deliveryQuantity' },
      { label: '实际重量', value: 'actualWeight' },
      { label: '损耗数量', value: 'lossQuantity' },
      { label: '单位', value: 'unit' },
      { label: '单价', value: 'unitPrice' },
      { label: '损耗金额', value: 'lossAmount' },
      { label: '是否重复', value: 'isDuplicate' },
      { label: '重复来源ID', value: 'duplicateSourceId' },
      { label: '数据来源', value: 'sourceType' },
      { label: '状态', value: 'status' },
      { label: '确认人', value: 'confirmedBy' },
      { label: '确认时间', value: 'confirmedAt' },
      { label: '备注', value: 'remark' },
      { label: '创建时间', value: 'createdAt' },
    ];

    return this.writeCSV(data, fields, 'loss_records');
  }

  static async exportImportBatches(params = {}) {
    logger.info('导出导入批次');

    const where = {};
    if (params.sourceFileType) where.sourceFileType = params.sourceFileType;
    if (params.status) where.status = params.status;

    const batches = await ImportBatch.findAll({
      where,
      order: [['createdAt', 'DESC']],
    });

    const data = batches.map(b => ({
      id: b.id,
      sourceFileName: b.sourceFileName,
      sourceFileType: this.getSourceFileTypeName(b.sourceFileType),
      fileHash: b.fileHash,
      totalRows: b.totalRows,
      successRows: b.successRows,
      failedRows: b.failedRows,
      status: b.status,
      importedBy: b.importedBy || '',
      errorMessage: b.errorMessage || '',
      createdAt: b.createdAt.toISOString(),
    }));

    const fields = [
      { label: '批次ID', value: 'id' },
      { label: '文件名', value: 'sourceFileName' },
      { label: '文件类型', value: 'sourceFileType' },
      { label: '文件哈希', value: 'fileHash' },
      { label: '总行数', value: 'totalRows' },
      { label: '成功行数', value: 'successRows' },
      { label: '失败行数', value: 'failedRows' },
      { label: '状态', value: 'status' },
      { label: '导入人', value: 'importedBy' },
      { label: '错误信息', value: 'errorMessage' },
      { label: '导入时间', value: 'createdAt' },
    ];

    return this.writeCSV(data, fields, 'import_batches');
  }

  static writeCSV(data, fields, prefix) {
    this.ensureExportDir();

    const parser = new Parser({ fields });
    const csv = parser.parse(data);

    const fileName = this.generateFileName(prefix);
    const filePath = path.join(config.export.dir, fileName);

    fs.writeFileSync(filePath, '\uFEFF' + csv, 'utf8');

    logger.info(`导出完成: ${filePath}, 共 ${data.length} 条`);

    return {
      fileName,
      filePath,
      recordCount: data.length,
    };
  }

  static getJobTypeName(type) {
    const names = {
      loss_calculation: '损耗计算',
      bad_fruit_deduction: '坏果扣款',
      secondary_sorting: '二次分拣',
      duplicate_check: '重复检查',
      compensation: '补偿入账',
      external_receipt: '外部回执',
    };
    return names[type] || type;
  }

  static getStatusName(status) {
    const names = {
      pending: '待处理',
      processing: '处理中',
      waiting_retry: '等重试',
      waiting_manual: '等人工',
      permanent_failed: '永久失败',
      success: '成功',
      closed: '已关闭',
    };
    return names[status] || status;
  }

  static getLossTypeName(type) {
    const names = {
      bad_fruit: '坏果扣款',
      secondary_sorting: '二次分拣损耗',
      other: '其他',
    };
    return names[type] || type;
  }

  static getLossStatusName(status) {
    const names = {
      pending: '待确认',
      confirmed: '已确认',
      adjusted: '已调整',
      compensated: '已补偿',
      closed: '已关闭',
    };
    return names[status] || status;
  }

  static getSourceTypeName(type) {
    const names = {
      delivery: '送货单',
      weighing: '称重记录',
      basket_return: '退筐记录',
      manual: '手工录入',
    };
    return names[type] || type;
  }

  static getSourceFileTypeName(type) {
    const names = {
      delivery_note: '供应商送货单',
      weighing_record: '称重记录',
      basket_return: '退筐照片',
    };
    return names[type] || type;
  }
}

module.exports = ExportService;
