const fs = require('fs');
const csv = require('csv-parser');
const { createContract } = require('./contractService');

const parseCSV = async (filePath) => {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
};

const importContractsFromCSV = async (filePath, batchId) => {
  const contracts = await parseCSV(filePath);
  const imported = [];
  const errors = [];

  for (const contract of contracts) {
    try {
      const contractData = {
        contract_no: contract.contract_no || contract.合同编号,
        contract_name: contract.contract_name || contract.合同名称,
        party_a: contract.party_a || contract.甲方,
        party_b: contract.party_b || contract.乙方,
        amount: contract.amount ? parseFloat(contract.amount) : (contract.金额 ? parseFloat(contract.金额) : null),
        seal_type: contract.seal_type || contract.印章类型,
        authorizer: contract.authorizer || contract.授权人,
        express_no: contract.express_no || contract.快递单号,
        metadata: contract
      };

      const result = await createContract(batchId, contractData);
        imported.push({
          row: imported.length + 1,
          id: result.id,
          success: true
        });
    } catch (error) {
      errors.push({
        row: imported.length + errors.length + 1,
        error: error.message,
        success: false
      });
    }
  }

  return {
    total: contracts.length,
    imported: imported.length,
    failed: errors.length,
    errors
  };
};

const importMetadataFromJSON = async (filePath) => {
  const content = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(content);
};

module.exports = {
  parseCSV,
  importContractsFromCSV,
  importMetadataFromJSON
};
