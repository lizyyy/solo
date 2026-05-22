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

  for (let i = 0; i < contracts.length; i++) {
    const contract = contracts[i];
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
        row: i + 1,
        id: result.id,
        success: true
      });
    } catch (error) {
      errors.push({
        row: i + 1,
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

const importContractsFromJSON = async (filePath, batchId) => {
  const metadata = await importMetadataFromJSON(filePath);
  
  let contractList = [];
  if (Array.isArray(metadata)) {
    contractList = metadata;
  } else if (metadata.contracts && Array.isArray(metadata.contracts)) {
    contractList = metadata.contracts;
  } else if (metadata.items && Array.isArray(metadata.items)) {
    contractList = metadata.items;
  } else {
    contractList = [metadata];
  }

  const imported = [];
  const errors = [];

  for (let i = 0; i < contractList.length; i++) {
    const contract = contractList[i];
    try {
      const contractData = {
        contract_no: contract.contract_no || contract.contractNo || contract.合同编号,
        contract_name: contract.contract_name || contract.contractName || contract.合同名称,
        party_a: contract.party_a || contract.partyA || contract.甲方,
        party_b: contract.party_b || contract.partyB || contract.乙方,
        amount: contract.amount ? parseFloat(contract.amount) : (contract.金额 ? parseFloat(contract.金额) : null),
        seal_type: contract.seal_type || contract.sealType || contract.印章类型,
        authorizer: contract.authorizer || contract.授权人,
        express_no: contract.express_no || contract.expressNo || contract.快递单号,
        metadata: contract
      };

      const result = await createContract(batchId, contractData);
      imported.push({
        index: i + 1,
        id: result.id,
        contract_no: contractData.contract_no,
        success: true
      });
    } catch (error) {
      errors.push({
        index: i + 1,
        contract_no: contract.contract_no || contract.contractNo || null,
        error: error.message,
        success: false
      });
    }
  }

  return {
    total: contractList.length,
    imported: imported.length,
    failed: errors.length,
    imported_items: imported,
    errors
  };
};

const importContractsFromJSONData = async (jsonData, batchId) => {
  let contractList = [];
  if (Array.isArray(jsonData)) {
    contractList = jsonData;
  } else if (jsonData.contracts && Array.isArray(jsonData.contracts)) {
    contractList = jsonData.contracts;
  } else if (jsonData.items && Array.isArray(jsonData.items)) {
    contractList = jsonData.items;
  } else {
    contractList = [jsonData];
  }

  const imported = [];
  const errors = [];

  for (let i = 0; i < contractList.length; i++) {
    const contract = contractList[i];
    try {
      const contractData = {
        contract_no: contract.contract_no || contract.contractNo || contract.合同编号,
        contract_name: contract.contract_name || contract.contractName || contract.合同名称,
        party_a: contract.party_a || contract.partyA || contract.甲方,
        party_b: contract.party_b || contract.partyB || contract.乙方,
        amount: contract.amount ? parseFloat(contract.amount) : (contract.金额 ? parseFloat(contract.金额) : null),
        seal_type: contract.seal_type || contract.sealType || contract.印章类型,
        authorizer: contract.authorizer || contract.授权人,
        express_no: contract.express_no || contract.expressNo || contract.快递单号,
        metadata: contract
      };

      const result = await createContract(batchId, contractData);
      imported.push({
        index: i + 1,
        id: result.id,
        contract_no: contractData.contract_no,
        success: true
      });
    } catch (error) {
      errors.push({
        index: i + 1,
        contract_no: contract.contract_no || contract.contractNo || null,
        error: error.message,
        success: false
      });
    }
  }

  return {
    total: contractList.length,
    imported: imported.length,
    failed: errors.length,
    imported_items: imported,
    errors
  };
};

module.exports = {
  parseCSV,
  importContractsFromCSV,
  importMetadataFromJSON,
  importContractsFromJSON,
  importContractsFromJSONData
};
