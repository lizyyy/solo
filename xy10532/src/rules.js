const storage = require('./storage');

const DEFAULT_RULES = {
  claimTypes: {
    outpatient: {
      name: '门诊理赔',
      requiredMaterials: [
        { type: 'DIAGNOSIS_CERTIFICATE', name: '诊断证明书', required: true },
        { type: 'OUTPATIENT_INVOICE', name: '门诊发票', required: true },
        { type: 'OUTPATIENT_LIST', name: '门诊费用清单', required: true },
        { type: 'MEDICAL_RECORD', name: '门诊病历', required: false }
      ],
      invoiceTypes: ['OUTPATIENT_INVOICE'],
      listTypes: ['OUTPATIENT_LIST']
    },
    inpatient: {
      name: '住院理赔',
      requiredMaterials: [
        { type: 'DISCHARGE_SUMMARY', name: '出院小结', required: true },
        { type: 'HOSPITAL_INVOICE', name: '住院发票', required: true },
        { type: 'HOSPITAL_LIST', name: '住院费用清单', required: true },
        { type: 'DIAGNOSIS_CERTIFICATE', name: '诊断证明书', required: true },
        { type: 'ADMISSION_RECORD', name: '入院记录', required: false }
      ],
      invoiceTypes: ['HOSPITAL_INVOICE'],
      listTypes: ['HOSPITAL_LIST']
    },
    traffic_accident: {
      name: '交通事故理赔',
      requiredMaterials: [
        { type: 'TRAFFIC_ACCIDENT_RECOGNITION', name: '交通事故认定书', required: true },
        { type: 'MEDICAL_INVOICE', name: '医疗发票', required: true },
        { type: 'MEDICAL_LIST', name: '医疗费用清单', required: true },
        { type: 'DIAGNOSIS_CERTIFICATE', name: '诊断证明书', required: true },
        { type: 'MEDICAL_RECORD', name: '病历资料', required: true },
        { type: 'IDENTITY_CARD', name: '身份证', required: true },
        { type: 'DRIVER_LICENSE', name: '驾驶证', required: false },
        { type: 'VEHICLE_LICENSE', name: '行驶证', required: false }
      ],
      invoiceTypes: ['MEDICAL_INVOICE', 'HOSPITAL_INVOICE', 'OUTPATIENT_INVOICE'],
      listTypes: ['MEDICAL_LIST', 'HOSPITAL_LIST', 'OUTPATIENT_LIST']
    }
  },
  tolerance: 0.01
};

function getRules(workspace) {
  const saved = storage.loadRules(workspace);
  if (saved) return saved;
  storage.saveRules(workspace, DEFAULT_RULES);
  return DEFAULT_RULES;
}

function checkDuplicateInvoices(materials, invoiceTypes, existingInvoices = new Map()) {
  const invoiceMap = new Map(existingInvoices);
  const duplicates = [];
  
  const invoiceMaterials = materials.filter(m => 
    invoiceTypes.includes(m.type) && m.invoiceNumber
  );
  
  invoiceMaterials.forEach(m => {
    if (invoiceMap.has(m.invoiceNumber)) {
      const existingInfo = invoiceMap.get(m.invoiceNumber);
      duplicates.push({
        materialId: m.id,
        invoiceNumber: m.invoiceNumber,
        firstMaterialId: existingInfo.materialId,
        firstCaseId: existingInfo.caseId,
        materialName: m.name,
        isCrossCase: existingInfo.caseId !== null
      });
    } else {
      invoiceMap.set(m.invoiceNumber, {
        materialId: m.id,
        caseId: null
      });
    }
  });
  
  return duplicates;
}

function checkAmountConsistency(materials, invoiceTypes, listTypes, tolerance) {
  const inconsistencies = [];
  const invoices = materials.filter(m => invoiceTypes.includes(m.type));
  const lists = materials.filter(m => listTypes.includes(m.type));
  
  invoices.forEach(invoice => {
    const invoiceAmount = Number(invoice.amount) || 0;
    const matchingList = lists.find(l => {
      if (l.invoiceNumber && invoice.invoiceNumber) {
        return l.invoiceNumber === invoice.invoiceNumber;
      }
      return Math.abs((Number(l.amount) || 0) - invoiceAmount) <= tolerance;
    });
    
    if (matchingList) {
      const listAmount = Number(matchingList.amount) || 0;
      const diff = Math.abs(invoiceAmount - listAmount);
      if (diff > tolerance) {
        inconsistencies.push({
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber || '未知',
          invoiceAmount,
          listId: matchingList.id,
          listAmount,
          difference: diff,
          message: `发票金额 ¥${invoiceAmount.toFixed(2)} 与费用清单金额 ¥${listAmount.toFixed(2)} 不一致，差额 ¥${diff.toFixed(2)}`
        });
      }
    } else {
      const hasAnyList = lists.length > 0;
      if (!hasAnyList) {
        inconsistencies.push({
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber || '未知',
          invoiceAmount,
          message: '未找到对应的费用清单'
        });
      }
    }
  });
  
  return inconsistencies;
}

function checkUncertainTypes(materials) {
  return materials.filter(m => m.type === 'UNCERTAIN' || !m.type).map(m => ({
    materialId: m.id,
    materialName: m.name,
    source: m.source,
    message: `材料类型识别不确定: ${m.name}`
  }));
}

function checkMissingMaterials(materials, requiredMaterials) {
  const missing = [];
  
  requiredMaterials.forEach(req => {
    if (!req.required) return;
    
    const found = materials.some(m => m.type === req.type && !m.rejected);
    if (!found) {
      const hasWaived = materials.some(m => m.type === req.type && m.waived);
      if (!hasWaived) {
        missing.push({
          type: req.type,
          name: req.name,
          required: true,
          message: `缺少必需材料: ${req.name} (${req.type})`
        });
      }
    }
  });
  
  return missing;
}

function checkWaivedRequired(materials, requiredMaterials) {
  const violations = [];
  
  requiredMaterials.forEach(req => {
    if (!req.required) return;
    
    const waived = materials.filter(m => m.type === req.type && m.waived);
    waived.forEach(m => {
      violations.push({
        materialId: m.id,
        materialName: m.name,
        type: req.type,
        name: req.name,
        message: `必需材料不可豁免: ${req.name}`
      });
    });
  });
  
  return violations;
}

function validateCase(caseData, workspace) {
  const rules = getRules(workspace);
  const claimTypeConfig = rules.claimTypes[caseData.claimType];
  
  if (!claimTypeConfig) {
    return {
      valid: false,
      errors: [{ message: `未知的理赔类型: ${caseData.claimType}` }],
      issues: [],
      status: 'ERROR'
    };
  }
  
  const materials = caseData.materials || [];
  const tolerance = rules.tolerance || 0.01;
  
  const duplicates = checkDuplicateInvoices(materials, claimTypeConfig.invoiceTypes);
  const amountIssues = checkAmountConsistency(materials, claimTypeConfig.invoiceTypes, claimTypeConfig.listTypes, tolerance);
  const uncertain = checkUncertainTypes(materials);
  const missing = checkMissingMaterials(materials, claimTypeConfig.requiredMaterials);
  const waivedViolations = checkWaivedRequired(materials, claimTypeConfig.requiredMaterials);
  
  const issues = [];
  
  duplicates.forEach(d => {
    const crossCaseInfo = d.isCrossCase ? ` (案件 ${d.firstCaseId})` : '';
    issues.push({
      level: 'ERROR',
      category: 'DUPLICATE_INVOICE',
      ...d,
      message: `重复票据: 发票号 ${d.invoiceNumber} 已存在${crossCaseInfo}`
    });
  });
  
  amountIssues.forEach(a => {
    issues.push({
      level: 'ERROR',
      category: 'AMOUNT_INCONSISTENCY',
      ...a
    });
  });
  
  uncertain.forEach(u => {
    issues.push({
      level: 'WARNING',
      category: 'UNCERTAIN_TYPE',
      ...u
    });
  });
  
  missing.forEach(m => {
    issues.push({
      level: 'ERROR',
      category: 'MISSING_MATERIAL',
      ...m
    });
  });
  
  waivedViolations.forEach(v => {
    issues.push({
      level: 'ERROR',
      category: 'WAIVED_REQUIRED',
      ...v
    });
  });
  
  const errors = issues.filter(i => i.level === 'ERROR');
  const warnings = issues.filter(i => i.level === 'WARNING');
  
  let status = 'PENDING_CHECK';
  if (issues.length === 0) {
    status = 'ACCEPTABLE';
  } else if (errors.length > 0) {
    const hasMissing = errors.some(e => e.category === 'MISSING_MATERIAL');
    const hasAmount = errors.some(e => e.category === 'AMOUNT_INCONSISTENCY');
    if (hasAmount && !hasMissing) {
      status = 'AMOUNT_ISSUE';
    } else {
      status = 'NEEDS_SUPPLEMENT';
    }
  } else if (warnings.length > 0) {
    status = 'ACCEPTABLE_WITH_WARNING';
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    issues,
    status,
    claimTypeName: claimTypeConfig.name,
    rulesApplied: {
      claimType: caseData.claimType,
      tolerance,
      checkedAt: new Date().toISOString()
    }
  };
}

module.exports = {
  DEFAULT_RULES,
  getRules,
  validateCase,
  checkDuplicateInvoices,
  checkAmountConsistency,
  checkUncertainTypes,
  checkMissingMaterials,
  checkWaivedRequired
};
