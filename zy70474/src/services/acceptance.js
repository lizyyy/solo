const store = require('../models/store');
const signatureService = require('./signature');

class AcceptanceService {
  async submitAcceptanceForm(formData, items) {
    const form = store.createAcceptanceForm({
      department: formData.department,
      submitter: formData.submitter,
      totalAmount: formData.totalAmount
    });

    const results = [];
    let successCount = 0;
    let failCount = 0;

    for (const item of items) {
      const detail = store.createTaskDetail({
        formId: form.id,
        itemNo: item.itemNo,
        projectName: item.projectName,
        outsourcingVendor: item.outsourcingVendor,
        workContent: item.workContent,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal,
        signAlgorithm: item.signAlgorithm,
        signature: item.signature
      });

      const verifyResult = signatureService.verifyTaskDetail(item);

      if (verifyResult.valid && verifyResult.algorithmMatch) {
        store.updateTaskDetail(detail.id, { status: 'success' });
        successCount++;
        results.push({
          detailId: detail.id,
          itemNo: item.itemNo,
          status: 'success',
          message: '验签通过'
        });
      } else {
        store.updateTaskDetail(detail.id, {
          status: 'failed',
          errorMessage: verifyResult.error
        });
        failCount++;
        results.push({
          detailId: detail.id,
          itemNo: item.itemNo,
          status: 'failed',
          error: verifyResult.error,
          algorithmMatch: verifyResult.algorithmMatch,
          expectedAlgorithm: verifyResult.expectedAlgorithm,
          providedAlgorithm: verifyResult.providedAlgorithm
        });
      }
    }

    let formStatus = 'completed';
    if (failCount > 0 && successCount === 0) {
      formStatus = 'failed';
    } else if (failCount > 0 && successCount > 0) {
      formStatus = 'partial';
    }

    store.updateAcceptanceForm(form.id, { status: formStatus });

    return {
      formId: form.id,
      batchNo: form.batchNo,
      status: formStatus,
      total: items.length,
      successCount,
      failCount,
      results
    };
  }

  async getAcceptanceDetail(formId) {
    const form = store.getAcceptanceForm(formId);
    if (!form) {
      return null;
    }

    const details = store.listTaskDetails({ formId });

    return {
      form,
      details
    };
  }
}

module.exports = new AcceptanceService();