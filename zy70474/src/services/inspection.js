const store = require('../models/store');
const moment = require('moment');

class InspectionService {
  generateNightlyInspection(inspectionDate) {
    const date = inspectionDate || moment().format('YYYY-MM-DD');
    
    const details = store.listTaskDetails();
    const failedItems = details.filter(d => d.status === 'failed');

    const inspectionItems = failedItems.map(d => ({
      detailId: d.id,
      itemNo: d.itemNo,
      projectName: d.projectName,
      outsourcingVendor: d.outsourcingVendor,
      errorMessage: d.errorMessage,
      rerunCount: d.rerunCount,
      lastRerunId: d.lastRerunId,
      suggestion: this._getSuggestion(d),
      reviewStatus: 'pending',
      reviewResult: null
    }));

    const report = store.createInspectionReport({
      inspectionDate: date,
      inspector: 'system',
      items: inspectionItems,
      status: 'pending_review'
    });

    return report;
  }

  _getSuggestion(detail) {
    if (detail.errorMessage && detail.errorMessage.includes('签名算法不一致')) {
      return '建议核实外包提交的签名算法，要求其使用SHA256算法重新签名后提交';
    }
    if (detail.errorMessage && detail.errorMessage.includes('签名值不匹配')) {
      return '建议核对数据完整性，确认提交内容是否被篡改';
    }
    return '建议联系外包供应商重新核实材料';
  }

  addReviewSample(reportId) {
    const report = store.getInspectionReport(reportId);
    if (!report) {
      throw new Error('巡检报告不存在');
    }

    if (report.items.length === 0) {
      return report;
    }

    const sampleItem = report.items[0];
    sampleItem.reviewStatus = 'reviewed';
    sampleItem.reviewResult = {
      action: 'contact_vendor_and_rerun',
      contactPerson: '张经理',
      expectedCompletionDate: moment().add(1, 'days').format('YYYY-MM-DD'),
      reviewer: '李主管',
      reviewComment: '已联系外包供应商，确认使用MD5算法签名，要求改用SHA256重签后提交',
      reviewedAt: new Date().toISOString()
    };

    return store.updateInspectionReport(reportId, {
      items: report.items,
      reviewer: '李主管',
      reviewedAt: new Date().toISOString()
    });
  }

  reviewItem(reportId, detailId, reviewData) {
    const report = store.getInspectionReport(reportId);
    if (!report) {
      throw new Error('巡检报告不存在');
    }

    const item = report.items.find(i => i.detailId === detailId);
    if (!item) {
      throw new Error('巡检项不存在');
    }

    item.reviewStatus = 'reviewed';
    item.reviewResult = {
      ...reviewData,
      reviewedAt: new Date().toISOString()
    };

    return store.updateInspectionReport(reportId, { items: report.items });
  }

  getInspectionWithRerunTrace(reportId) {
    const report = store.getInspectionReport(reportId);
    if (!report) {
      return null;
    }

    const itemsWithTrace = report.items.map(item => {
      const rerunRecords = store.listRerunRecords({ taskDetailId: item.detailId });
      return {
        ...item,
        rerunHistory: rerunRecords
      };
    });

    return {
      ...report,
      items: itemsWithTrace
    };
  }

  listReports() {
    return store.listInspectionReports();
  }
}

module.exports = new InspectionService();