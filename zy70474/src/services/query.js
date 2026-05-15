const store = require('../models/store');

class QueryService {
  async queryTasks(filters = {}) {
    const { status, department, hasError, startDate, endDate, keyword } = filters;

    let details = store.listTaskDetails();

    if (status) {
      details = details.filter(d => d.status === status);
    }

    if (hasError === 'true') {
      details = details.filter(d => d.errorMessage !== null);
    }

    if (keyword) {
      const keywordLower = keyword.toLowerCase();
      details = details.filter(d => 
        d.projectName.toLowerCase().includes(keywordLower) ||
        d.outsourcingVendor.toLowerCase().includes(keywordLower) ||
        d.itemNo.toLowerCase().includes(keywordLower)
      );
    }

    const formsMap = new Map();
    for (const form of store.listAcceptanceForms()) {
      formsMap.set(form.id, form);
    }

    const results = details.map(d => {
      const form = formsMap.get(d.formId);
      return {
        ...d,
        formInfo: form ? {
          batchNo: form.batchNo,
          department: form.department,
          submitter: form.submitter,
          submitTime: form.submitTime
        } : null
      };
    });

    if (department) {
      results = results.filter(r => r.formInfo && r.formInfo.department === department);
    }

    if (startDate) {
      results = results.filter(r => new Date(r.createdAt) >= new Date(startDate));
    }

    if (endDate) {
      results = results.filter(r => new Date(r.createdAt) <= new Date(endDate));
    }

    return {
      total: results.length,
      successCount: results.filter(r => r.status === 'success').length,
      failedCount: results.filter(r => r.status === 'failed').length,
      pendingCount: results.filter(r => r.status === 'pending').length,
      items: results
    };
  }

  async getTaskTrace(detailId) {
    const detail = store.getTaskDetail(detailId);
    if (!detail) {
      return null;
    }

    const rerunRecords = store.listRerunRecords({ taskDetailId: detailId });
    const form = store.getAcceptanceForm(detail.formId);

    return {
      taskDetail: detail,
      formInfo: form,
      rerunHistory: rerunRecords
    };
  }

  async getStatistics() {
    const forms = store.listAcceptanceForms();
    const details = store.listTaskDetails();

    return {
      totalForms: forms.length,
      totalDetails: details.length,
      successDetails: details.filter(d => d.status === 'success').length,
      failedDetails: details.filter(d => d.status === 'failed').length,
      pendingDetails: details.filter(d => d.status === 'pending').length,
      partialForms: forms.filter(f => f.status === 'partial').length,
      failedForms: forms.filter(f => f.status === 'failed').length,
      hasRerunCount: details.filter(d => d.rerunCount > 0).length
    };
  }
}

module.exports = new QueryService();