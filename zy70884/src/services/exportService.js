const { Parser } = require('json2csv');
const { searchContracts, getContractsByBatchId } = require('./contractService');
const { getLogsByContractId } = require('./auditService');

const exportToCSV = async (filters, handler) => {
  const contracts = await searchContracts(filters);

  for (const contract of contracts) {
    const logs = await getLogsByContractId(contract.id);
    contract.audit_logs = JSON.stringify(logs);
  }

  const fields = [
    'id',
    'batch_id',
    'contract_no',
    'contract_name',
    'party_a',
    'party_b',
    'amount',
    'seal_type',
    'authorizer',
    'express_no',
    'status',
    'remark',
    'created_at',
    'updated_at',
    'audit_logs'
  ];

  const json2csvParser = new Parser({ fields });
  const csv = json2csvParser.parse(contracts);

  return {
    csv,
    count: contracts.length,
    filename: `contracts_export_${new Date().toISOString().slice(0, 10)}.csv`
  };
};

const exportBatchToCSV = async (batchId, handler) => {
  const contracts = await getContractsByBatchId(batchId);

  for (const contract of contracts) {
    const logs = await getLogsByContractId(contract.id);
    contract.audit_logs = JSON.stringify(logs);
  }

  const fields = [
    'id',
    'batch_id',
    'contract_no',
    'contract_name',
    'party_a',
    'party_b',
    'amount',
    'seal_type',
    'authorizer',
    'express_no',
    'status',
    'remark',
    'created_at',
    'updated_at',
    'audit_logs'
  ];

  const json2csvParser = new Parser({ fields });
  const csv = json2csvParser.parse(contracts);

  return {
    csv,
    count: contracts.length,
    filename: `batch_${batchId}_export_${new Date().toISOString().slice(0, 10)}.csv`
  };
};

const exportDetailWithTrace = async (filters, handler) => {
  const contracts = await searchContracts(filters);
  const detailedData = [];

  for (const contract of contracts) {
    const logs = await getLogsByContractId(contract.id);
    
    detailedData.push({
      contract_id: contract.id,
      batch_id: contract.batch_id,
      contract_no: contract.contract_no,
      contract_name: contract.contract_name,
      party_a: contract.party_a,
      party_b: contract.party_b,
      amount: contract.amount,
      seal_type: contract.seal_type,
      authorizer: contract.authorizer,
      express_no: contract.express_no,
      status: contract.status,
      remark: contract.remark,
      created_at: contract.created_at,
      log_count: logs.length,
      latest_action: logs.length > 0 ? logs[0].action_type : null,
      latest_reason: logs.length > 0 ? logs[0].action_reason : null,
      latest_handler: logs.length > 0 ? logs[0].handler : null,
      latest_time: logs.length > 0 ? logs[0].created_at : null
    });
  }

  const fields = [
    'contract_id',
    'batch_id',
    'contract_no',
    'contract_name',
    'party_a',
    'party_b',
    'amount',
    'seal_type',
    'authorizer',
    'express_no',
    'status',
    'remark',
    'created_at',
    'log_count',
    'latest_action',
    'latest_reason',
    'latest_handler',
    'latest_time'
  ];

  const json2csvParser = new Parser({ fields });
  const csv = json2csvParser.parse(detailedData);

  return {
    csv,
    count: detailedData.length,
    filename: `contracts_detail_${new Date().toISOString().slice(0, 10)}.csv`
  };
};

module.exports = {
  exportToCSV,
  exportBatchToCSV,
  exportDetailWithTrace
};
