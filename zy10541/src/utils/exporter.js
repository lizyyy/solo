const { Parser } = require('json2csv');

function generateEffectiveReport(contract) {
  const report = {
    reportId: `RPT-${Date.now()}`,
    generatedAt: new Date().toISOString(),
    contractInfo: {
      contractNo: contract.contractNo,
      customerName: contract.customerName,
      contractType: contract.contractType,
      version: contract.version,
      effectiveDate: contract.effectiveDate,
      price: contract.price,
      serviceScope: contract.serviceScope,
      currentStatus: contract.status
    },
    statusTimeline: contract.statusHistory.map(h => ({
      status: h.status,
      operator: h.operator,
      comment: h.comment,
      timestamp: h.timestamp
    })),
    syncEvidence: contract.syncRecords.map(s => ({
      targetSystem: s.targetSystem,
      status: s.status,
      operator: s.operator,
      timestamp: s.timestamp,
      requestData: s.requestData,
      responseData: s.responseData,
      errorMessage: s.errorMessage,
      retryCount: s.retryCount
    })),
    correctionRecords: contract.corrections.map(c => ({
      correctionType: c.correctionType,
      oldValue: c.oldValue,
      newValue: c.newValue,
      reason: c.reason,
      operator: c.operator,
      approvalDoc: c.approvalDoc,
      timestamp: c.timestamp
    })),
    effectiveConclusion: {
      isEffective: contract.status === 'EFFECTIVE',
      priceConfirmed: contract.price > 0,
      serviceScopeValid: contract.serviceScope.length > 0,
      syncCompleted: contract.syncRecords.some(s => s.status === 'SUCCESS'),
      finalVerification: contract.status === 'EFFECTIVE' 
        ? '合同条款已生效，业务系统同步完成'
        : '合同条款未完全生效'
    }
  };
  return report;
}

function exportToJSON(contract) {
  const report = generateEffectiveReport(contract);
  return JSON.stringify(report, null, 2);
}

function exportToCSV(contract) {
  const report = generateEffectiveReport(contract);
  
  const basicFields = [
    'reportId', 'generatedAt', 'contractNo', 'customerName', 
    'version', 'effectiveDate', 'price', 'currentStatus',
    'isEffective', 'finalVerification'
  ];
  
  const basicData = {
    reportId: report.reportId,
    generatedAt: report.generatedAt,
    contractNo: report.contractInfo.contractNo,
    customerName: report.contractInfo.customerName,
    version: report.contractInfo.version,
    effectiveDate: report.contractInfo.effectiveDate,
    price: report.contractInfo.price,
    currentStatus: report.contractInfo.currentStatus,
    isEffective: report.effectiveConclusion.isEffective,
    finalVerification: report.effectiveConclusion.finalVerification
  };

  const json2csvParser = new Parser({ fields: basicFields });
  let csv = json2csvParser.parse([basicData]);
  
  csv += '\n\n=== 状态流转历史 ===\n';
  const statusFields = ['status', 'operator', 'comment', 'timestamp'];
  const statusParser = new Parser({ fields: statusFields });
  csv += statusParser.parse(report.statusTimeline);
  
  csv += '\n\n=== 同步记录 ===\n';
  const syncFields = ['targetSystem', 'status', 'operator', 'timestamp', 'retryCount'];
  const syncParser = new Parser({ fields: syncFields });
  csv += syncParser.parse(report.syncEvidence);
  
  if (report.correctionRecords.length > 0) {
    csv += '\n\n=== 人工修正记录 ===\n';
    const corrFields = ['correctionType', 'oldValue', 'newValue', 'reason', 'operator', 'approvalDoc', 'timestamp'];
    const corrParser = new Parser({ fields: corrFields });
    csv += corrParser.parse(report.correctionRecords);
  }

  return csv;
}

function exportServiceScopeList(contracts) {
  const data = contracts.map(c => ({
    contractNo: c.contractNo,
    customerName: c.customerName,
    version: c.version,
    status: c.status,
    serviceScope: c.serviceScope.join('; '),
    price: c.price,
    effectiveDate: c.effectiveDate
  }));
  
  const fields = ['contractNo', 'customerName', 'version', 'status', 'serviceScope', 'price', 'effectiveDate'];
  const json2csvParser = new Parser({ fields });
  return json2csvParser.parse(data);
}

module.exports = {
  generateEffectiveReport,
  exportToJSON,
  exportToCSV,
  exportServiceScopeList
};