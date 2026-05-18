const { REQUIRED_FIELDS } = require('./parser');

const MANDATORY_FIELDS = ['资产编号', '资产名称', '借用人工号', '借用人姓名', '借用部门', '借用日期', '应归还日期', '资产状态'];

function validateData(parseResults) {
  const validationResults = {
    validRecords: [],
    invalidRecords: [],
    duplicateRecords: [],
    specialCases: [],
    errors: [...parseResults.errors]
  };

  const assetIdMap = new Map();

  for (const record of parseResults.data) {
    const recordErrors = [];

    for (const field of MANDATORY_FIELDS) {
      if (!record[field] || String(record[field]).trim() === '') {
        recordErrors.push({
          field,
          message: `字段为空: ${field}`
        });
      }
    }

    const assetId = record['资产编号'];
    if (assetId) {
      if (assetIdMap.has(assetId)) {
        validationResults.duplicateRecords.push({
          record,
          original: assetIdMap.get(assetId),
          message: `重复的资产编号: ${assetId}`,
          sourceFile: record._sourceFile,
          rowNumber: record._rowNumber
        });
        recordErrors.push({
          field: '资产编号',
          message: `重复的资产编号: ${assetId}`
        });
      } else {
        assetIdMap.set(assetId, record);
      }
    }

    const assetStatus = record['资产状态'];
    const specialCase = checkSpecialCase(record);
    if (specialCase) {
      validationResults.specialCases.push(specialCase);
      if (specialCase.shouldExclude) {
        continue;
      }
    }

    if (recordErrors.length > 0) {
      validationResults.invalidRecords.push({
        record,
        errors: recordErrors,
        sourceFile: record._sourceFile,
        rowNumber: record._rowNumber
      });
    } else {
      validationResults.validRecords.push(record);
    }
  }

  return validationResults;
}

function checkSpecialCase(record) {
  const assetStatus = String(record['资产状态'] || '').trim();
  const borrowDepartment = String(record['借用部门'] || '').trim();
  const actualReturnDate = record['实际归还日期'];

  if (assetStatus.includes('维修') || assetStatus.includes('维修中')) {
    return {
      type: 'ASSET_UNDER_REPAIR',
      assetId: record['资产编号'],
      assetName: record['资产名称'],
      employeeName: record['借用人姓名'],
      employeeId: record['借用人工号'],
      department: borrowDepartment,
      message: `资产正在维修中，跳过催还: ${record['资产名称']}(${record['资产编号']})`,
      sourceFile: record._sourceFile,
      shouldExclude: true
    };
  }

  if (borrowDepartment.includes('离职') || borrowDepartment.includes('已离职')) {
    return {
      type: 'EMPLOYEE_RESIGNED',
      assetId: record['资产编号'],
      assetName: record['资产名称'],
      employeeName: record['借用人姓名'],
      employeeId: record['借用人工号'],
      message: `员工已离职，需特殊处理: ${record['借用人姓名']}(${record['借用人工号']})`,
      sourceFile: record._sourceFile,
      shouldExclude: false,
      requiresAttention: true
    };
  }

  if (borrowDepartment.includes('转部门') || borrowDepartment.includes('部门变更')) {
    return {
      type: 'DEPARTMENT_TRANSFER',
      assetId: record['资产编号'],
      assetName: record['资产名称'],
      employeeName: record['借用人姓名'],
      employeeId: record['借用人工号'],
      oldDepartment: borrowDepartment,
      message: `员工已转部门，需核实去向: ${record['借用人姓名']}(${record['借用人工号']})`,
      sourceFile: record._sourceFile,
      shouldExclude: false,
      requiresAttention: true
    };
  }

  return null;
}

module.exports = {
  validateData,
  checkSpecialCase
};
