const fs = require('fs');
const path = require('path');
const { createObjectCsvWriter } = require('csv-writer');
const moment = require('moment');
const { v4: uuidv4 } = require('uuid');
const { ExportRecord, Batch, ReplayHistory } = require('../models');
const BatchService = require('./BatchService');

const EXPORT_DIR = path.join(__dirname, '../../exports');

if (!fs.existsSync(EXPORT_DIR)) {
  fs.mkdirSync(EXPORT_DIR, { recursive: true });
}

const ExportService = {
  exportFields: {
    batchList: [
      { id: 'batchNo', title: '批次号' },
      { id: 'dataSource', title: '数据源' },
      { id: 'targetTable', title: '目标表' },
      { id: 'statusText', title: '状态' },
      { id: 'totalCount', title: '总记录数' },
      { id: 'successCount', title: '成功数' },
      { id: 'failCount', title: '失败数' },
      { id: 'failReason', title: '失败原因' },
      { id: 'hasPartialSuccess', title: '是否部分成功' },
      { id: 'replayCount', title: '重放次数' },
      { id: 'lastReplayAt', title: '最后重放时间' },
      { id: 'createdBy', title: '创建人' },
      { id: 'createdAt', title: '创建时间' },
      { id: 'completedAt', title: '完成时间' }
    ],
    replayHistory: [
      { id: 'replayNo', title: '重放序号' },
      { id: 'batchNo', title: '批次号' },
      { id: 'operator', title: '操作人' },
      { id: 'statusText', title: '重放结果' },
      { id: 'reason', title: '重放原因' },
      { id: 'totalCount', title: '总记录数' },
      { id: 'successCount', title: '成功数' },
      { id: 'failCount', title: '失败数' },
      { id: 'conflictCount', title: '冲突数' },
      { id: 'skipCount', title: '跳过数' },
      { id: 'startedAt', title: '开始时间' },
      { id: 'finishedAt', title: '结束时间' }
    ],
    failRecords: [
      { id: 'lineNo', title: '行号' },
      { id: 'recordKey', title: '记录标识' },
      { id: 'failReason', title: '失败原因' },
      { id: 'failType', title: '失败类型' },
      { id: 'rawData', title: '原始数据' },
      { id: 'batchNo', title: '所属批次' },
      { id: 'replayNo', title: '重放序号' }
    ]
  },

  async createExportRequest(exportType, filters, operator, asyncProcess = true) {
    const exportNo = `EXP${moment().format('YYYYMMDDHHmmss')}${uuidv4().slice(0, 4).toUpperCase()}`;
    
    const exportRecord = await ExportRecord.create({
      exportNo,
      exportType,
      status: ExportRecord.Status.PENDING,
      operator,
      filters
    });

    if (asyncProcess) {
      process.nextTick(() => this.processExport(exportRecord.id));
    }

    return {
      exportNo,
      id: exportRecord.id,
      status: exportRecord.status
    };
  },

  async processExport(exportId) {
    try {
      const exportRecord = await ExportRecord.findByPk(exportId);
      if (!exportRecord) return;

      await exportRecord.update({ status: ExportRecord.Status.PROCESSING });

      let data;
      let fields;
      let fileName;

      switch (exportRecord.exportType) {
        case ExportRecord.Type.BATCH_LIST:
          data = await this.getBatchListData(exportRecord.filters);
          fields = this.exportFields.batchList;
          fileName = `同步批次列表_${moment().format('YYYYMMDDHHmmss')}.csv`;
          break;
        case ExportRecord.Type.REPLAY_HISTORY:
          data = await this.getReplayHistoryData(exportRecord.filters);
          fields = this.exportFields.replayHistory;
          fileName = `重放历史记录_${moment().format('YYYYMMDDHHmmss')}.csv`;
          break;
        case ExportRecord.Type.FAIL_RECORDS:
          data = await this.getFailRecordsData(exportRecord.filters);
          fields = this.exportFields.failRecords;
          fileName = `失败记录明细_${moment().format('YYYYMMDDHHmmss')}.csv`;
          break;
        default:
          throw new Error('不支持的导出类型');
      }

      const filePath = path.join(EXPORT_DIR, fileName);
      await this.writeCsv(filePath, fields, data);

      const stats = fs.statSync(filePath);

      await exportRecord.update({
        status: ExportRecord.Status.COMPLETED,
        fileName,
        filePath,
        fileSize: stats.size,
        recordCount: data.length,
        expiredAt: moment().add(7, 'days').toDate()
      });

    } catch (error) {
      const exportRecord = await ExportRecord.findByPk(exportId);
      if (exportRecord) {
        await exportRecord.update({
          status: ExportRecord.Status.FAILED,
          errorMsg: error.message
        });
      }
    }
  },

  async getBatchListData(filters = {}) {
    const result = await BatchService.list({ ...filters, pageSize: 10000 });
    return result.list.map(item => ({
      ...item,
      hasPartialSuccess: item.hasPartialSuccess ? '是' : '否',
      createdAt: this.formatDate(item.createdAt),
      lastReplayAt: this.formatDate(item.lastReplayAt),
      completedAt: this.formatDate(item.completedAt)
    }));
  },

  async getReplayHistoryData(filters = {}) {
    const { batchId } = filters;
    const where = batchId ? { batchId } : {};
    
    const histories = await ReplayHistory.findAll({
      where,
      include: [{ model: Batch, as: 'batch', attributes: ['batchNo'] }],
      order: [['createdAt', 'DESC']]
    });

    return histories.map(h => {
      const formatted = BatchService.formatReplayHistory(h);
      return {
        ...formatted,
        batchNo: h.batch?.batchNo,
        startedAt: this.formatDate(formatted.startedAt),
        finishedAt: this.formatDate(formatted.finishedAt)
      };
    });
  },

  async getFailRecordsData(filters = {}) {
    const { batchId } = filters;
    const histories = await ReplayHistory.findAll({
      where: batchId ? { batchId } : {},
      include: [{ model: Batch, as: 'batch', attributes: ['batchNo'] }]
    });

    const failRecords = [];
    for (const h of histories) {
      if (h.failRecords && Array.isArray(h.failRecords)) {
        h.failRecords.forEach((record, idx) => {
          failRecords.push({
            lineNo: idx + 1,
            recordKey: record.recordKey || record.id || '',
            failReason: record.reason || record.failReason || '',
            failType: record.type || '数据错误',
            rawData: JSON.stringify(record.data || record).substring(0, 500),
            batchNo: h.batch?.batchNo,
            replayNo: h.replayNo
          });
        });
      }
    }

    return failRecords;
  },

  async writeCsv(filePath, fields, data) {
    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: fields,
      encoding: 'utf8'
    });

    await csvWriter.writeRecords(data);
  },

  async getExportStatus(exportId) {
    const record = await ExportRecord.findByPk(exportId);
    if (!record) {
      throw new Error('导出记录不存在');
    }

    const statusText = {
      [ExportRecord.Status.PENDING]: '待处理',
      [ExportRecord.Status.PROCESSING]: '处理中',
      [ExportRecord.Status.COMPLETED]: '已完成',
      [ExportRecord.Status.FAILED]: '失败'
    };

    return {
      id: record.id,
      exportNo: record.exportNo,
      exportType: record.exportType,
      status: record.status,
      statusText: statusText[record.status],
      fileName: record.fileName,
      fileSize: record.fileSize,
      recordCount: record.recordCount,
      errorMsg: record.errorMsg,
      expiredAt: record.expiredAt,
      createdAt: record.createdAt
    };
  },

  formatDate(date) {
    if (!date) return '';
    return moment(date).format('YYYY-MM-DD HH:mm:ss');
  }
};

module.exports = ExportService;
