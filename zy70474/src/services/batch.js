const store = require('../models/store');
const signatureService = require('./signature');

class BatchService {
  async previewRerun(filters) {
    const details = store.listTaskDetails(filters);
    const failedDetails = details.filter(d => d.status === 'failed');

    const preview = {
      totalAffected: failedDetails.length,
      items: failedDetails.map(d => ({
        detailId: d.id,
        itemNo: d.itemNo,
        projectName: d.projectName,
        outsourcingVendor: d.outsourcingVendor,
        currentStatus: d.status,
        errorMessage: d.errorMessage,
        rerunCount: d.rerunCount
      })),
      estimatedAction: '重新执行验签流程'
    };

    return preview;
  }

  async executeRerun(filters, operator) {
    const details = store.listTaskDetails(filters);
    const failedDetails = details.filter(d => d.status === 'failed');

    const results = [];
    let successCount = 0;
    let failCount = 0;

    for (const detail of failedDetails) {
      const rerunRecord = store.createRerunRecord({
        taskDetailId: detail.id,
        previousStatus: detail.status,
        action: 'rerun_signature_verification',
        operator,
        inputSnapshot: {
          signAlgorithm: detail.signAlgorithm,
          signature: detail.signature,
          itemNo: detail.itemNo,
          projectName: detail.projectName
        }
      });

      store.updateTaskDetail(detail.id, {
        lastRerunId: rerunRecord.id,
        rerunCount: detail.rerunCount + 1
      });

      const verifyResult = signatureService.verifyTaskDetail(detail);
      let newStatus = detail.status;
      let conclusion = '重跑失败';

      if (verifyResult.valid && verifyResult.algorithmMatch) {
        newStatus = 'success';
        conclusion = '重跑成功，验签通过';
        successCount++;
      } else {
        conclusion = `重跑失败: ${verifyResult.error}`;
        failCount++;
      }

      store.updateTaskDetail(detail.id, {
        status: newStatus,
        errorMessage: verifyResult.algorithmMatch ? null : verifyResult.error
      });

      store.updateRerunRecord(rerunRecord.id, {
        status: 'completed',
        conclusion
      });

      results.push({
        detailId: detail.id,
        itemNo: detail.itemNo,
        previousStatus: detail.status,
        newStatus,
        rerunId: rerunRecord.id,
        conclusion
      });
    }

    return {
      totalProcessed: failedDetails.length,
      successCount,
      failCount,
      results
    };
  }

  async fixSignature(detailId, newAlgorithm, newSignature, operator) {
    const detail = store.getTaskDetail(detailId);
    if (!detail) {
      throw new Error('任务明细不存在');
    }

    const rerunRecord = store.createRerunRecord({
      taskDetailId: detailId,
      previousStatus: detail.status,
      action: 'fix_and_rerun',
      operator,
      inputSnapshot: {
        oldAlgorithm: detail.signAlgorithm,
        oldSignature: detail.signature,
        newAlgorithm,
        newSignature
      }
    });

    const updatedDetail = store.updateTaskDetail(detailId, {
      signAlgorithm: newAlgorithm,
      signature: newSignature,
      lastRerunId: rerunRecord.id,
      rerunCount: detail.rerunCount + 1
    });

    const verifyResult = signatureService.verifyTaskDetail(updatedDetail);
    let conclusion = '';

    if (verifyResult.valid && verifyResult.algorithmMatch) {
      store.updateTaskDetail(detailId, {
        status: 'success',
        errorMessage: null
      });
      conclusion = '签名修正后验签通过';
    } else {
      store.updateTaskDetail(detailId, {
        status: 'failed',
        errorMessage: verifyResult.error
      });
      conclusion = `签名修正后仍失败: ${verifyResult.error}`;
    }

    store.updateRerunRecord(rerunRecord.id, {
      status: 'completed',
      conclusion
    });

    const finalDetail = store.getTaskDetail(detailId);

    return {
      detailId,
      rerunId: rerunRecord.id,
      status: finalDetail.status,
      conclusion
    };
  }
}

module.exports = new BatchService();