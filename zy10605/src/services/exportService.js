const fs = require('fs');
const path = require('path');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const moment = require('moment');

class ExportService {
  constructor(store, exportDir) {
    this.store = store;
    this.exportDir = exportDir || path.join(process.cwd(), 'exports');
    this.init();
  }

  init() {
    if (!fs.existsSync(this.exportDir)) {
      fs.mkdirSync(this.exportDir, { recursive: true });
    }
  }

  async exportReplayPermissions(filters = {}) {
    let permissions = this.store.getAll('replayPermissions');

    if (filters.status) {
      permissions = permissions.filter(p => p.status === filters.status);
    }
    if (filters.isRefundedStudent) {
      permissions = permissions.filter(p => p.isRefundedStudent === true);
    }
    if (filters.startDate) {
      permissions = permissions.filter(p => new Date(p.createdAt) >= new Date(filters.startDate));
    }
    if (filters.endDate) {
      permissions = permissions.filter(p => new Date(p.createdAt) <= new Date(filters.endDate));
    }

    const exportData = permissions.map(p => ({
      id: p.id,
      orderNumber: p.orderNumber,
      sessionTitle: p.sessionTitle,
      studentId: p.studentId,
      studentName: p.studentName,
      status: p.status,
      reason: p.reason,
      isRefundedStudent: p.isRefundedStudent ? '是' : '否',
      refundKeepAccess: p.isRefundedStudent ? '退款学员通过旧链接观看' : '',
      createdAt: moment(p.createdAt).format('YYYY-MM-DD HH:mm:ss'),
      unlockedAt: p.unlockedAt ? moment(p.unlockedAt).format('YYYY-MM-DD HH:mm:ss') : '',
      expiredAt: p.expiredAt ? moment(p.expiredAt).format('YYYY-MM-DD HH:mm:ss') : '',
      revokedAt: p.revokedAt ? moment(p.revokedAt).format('YYYY-MM-DD HH:mm:ss') : '',
      expireAt: moment(p.expireAt).format('YYYY-MM-DD HH:mm:ss')
    }));

    const fileName = `回放权限导出_${moment().format('YYYYMMDD_HHmmss')}.csv`;
    const filePath = path.join(this.exportDir, fileName);

    const csvWriter = createCsvWriter({
      path: filePath,
      header: [
        { id: 'id', title: '权限ID' },
        { id: 'orderNumber', title: '订单号' },
        { id: 'sessionTitle', title: '直播场次' },
        { id: 'studentId', title: '学员ID' },
        { id: 'studentName', title: '学员姓名' },
        { id: 'status', title: '状态' },
        { id: 'reason', title: '解锁原因' },
        { id: 'isRefundedStudent', title: '是否退款学员' },
        { id: 'refundKeepAccess', title: '退款观看说明' },
        { id: 'createdAt', title: '申请时间' },
        { id: 'unlockedAt', title: '解锁时间' },
        { id: 'expiredAt', title: '过期时间' },
        { id: 'revokedAt', title: '撤销时间' },
        { id: 'expireAt', title: '有效期至' }
      ]
    });

    await csvWriter.writeRecords(exportData);

    return {
      fileName,
      filePath,
      recordCount: exportData.length,
      refundStudentCount: exportData.filter(r => r.isRefundedStudent === '是').length
    };
  }

  async exportHistory(replayId) {
    const history = this.store.find('history', h => h.replayId === replayId);
    const sortedHistory = history.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    const exportData = sortedHistory.map(h => ({
      id: h.id,
      replayId: h.replayId,
      source: h.source,
      operator: h.operator,
      action: h.action,
      previousStatus: h.previousStatus || '-',
      newStatus: h.newStatus,
      reason: h.reason || '-',
      timestamp: moment(h.timestamp).format('YYYY-MM-DD HH:mm:ss'),
      details: JSON.stringify(h.details || {})
    }));

    const fileName = `回放历史_${replayId}_${moment().format('YYYYMMDD_HHmmss')}.csv`;
    const filePath = path.join(this.exportDir, fileName);

    const csvWriter = createCsvWriter({
      path: filePath,
      header: [
        { id: 'id', title: '历史记录ID' },
        { id: 'replayId', title: '权限ID' },
        { id: 'source', title: '操作来源' },
        { id: 'operator', title: '操作者' },
        { id: 'action', title: '操作动作' },
        { id: 'previousStatus', title: '变更前状态' },
        { id: 'newStatus', title: '变更后状态' },
        { id: 'reason', title: '操作原因' },
        { id: 'timestamp', title: '操作时间' },
        { id: 'details', title: '详细信息' }
      ]
    });

    await csvWriter.writeRecords(exportData);

    return {
      fileName,
      filePath,
      recordCount: exportData.length
    };
  }

  async exportBadRecords() {
    const badRecords = this.store.getAll('badRecords');

    const exportData = badRecords.map(r => ({
      rowNumber: r.rowNumber,
      orderNumber: r.data.orderNumber || '-',
      sessionTitle: r.data.sessionTitle || '-',
      studentName: r.data.studentName || '-',
      error: r.error,
      importedAt: moment(r.importedAt).format('YYYY-MM-DD HH:mm:ss'),
      importedBy: r.importedBy,
      rawData: JSON.stringify(r.data)
    }));

    const fileName = `导入坏记录_${moment().format('YYYYMMDD_HHmmss')}.csv`;
    const filePath = path.join(this.exportDir, fileName);

    const csvWriter = createCsvWriter({
      path: filePath,
      header: [
        { id: 'rowNumber', title: '导入行号' },
        { id: 'orderNumber', title: '订单号' },
        { id: 'sessionTitle', title: '直播场次' },
        { id: 'studentName', title: '学员姓名' },
        { id: 'error', title: '错误原因' },
        { id: 'importedAt', title: '导入时间' },
        { id: 'importedBy', title: '导入人' },
        { id: 'rawData', title: '原始数据' }
      ]
    });

    await csvWriter.writeRecords(exportData);

    return {
      fileName,
      filePath,
      recordCount: exportData.length
    };
  }
}

module.exports = ExportService;
