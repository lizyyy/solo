const VALID_BUDGET_SUBJECTS = [
  '差旅费',
  '办公费',
  '业务招待费',
  '研发费用',
  '市场推广费',
  '员工福利费',
  '设备采购费',
  '咨询服务费'
];

const DISABLED_SUBJECTS = [
  '旧科目-招待费',
  '停用科目-差旅费'
];

const VALID_DEPARTMENTS = [
  '技术部',
  '市场部',
  '财务部',
  '人事部',
  '销售部',
  '产品部'
];

function validateRecords(records, options = {}) {
  const { allowCrossDepartment = true } = options;
  const errors = [];
  const warnings = [];
  const processedRecords = [];

  records.forEach(record => {
    const recordErrors = [];
    const recordWarnings = [];
    const processingNotes = [];

    if (!VALID_BUDGET_SUBJECTS.includes(record.原预算科目) && !DISABLED_SUBJECTS.includes(record.原预算科目)) {
      recordErrors.push({
        type: 'INVALID_ORIGINAL_SUBJECT',
        message: `原预算科目"${record.原预算科目}"不在有效科目列表中`,
        severity: 'ERROR'
      });
    }

    if (DISABLED_SUBJECTS.includes(record.调拨后预算科目)) {
      recordWarnings.push({
        type: 'DISABLED_TARGET_SUBJECT',
        message: `调拨后预算科目"${record.调拨后预算科目}"已停用，将跳过调拨`,
        severity: 'WARNING'
      });
      processingNotes.push('科目已停用，调拨跳过');
    } else if (!VALID_BUDGET_SUBJECTS.includes(record.调拨后预算科目)) {
      recordErrors.push({
        type: 'INVALID_TARGET_SUBJECT',
        message: `调拨后预算科目"${record.调拨后预算科目}"不在有效科目列表中`,
        severity: 'ERROR'
      });
    }

    if (!VALID_DEPARTMENTS.includes(record.部门)) {
      recordWarnings.push({
        type: 'UNKNOWN_DEPARTMENT',
        message: `部门"${record.部门}"不在标准部门列表中`,
        severity: 'WARNING'
      });
    }

    if (record.原预算科目 === record.调拨后预算科目) {
      recordWarnings.push({
        type: 'SAME_SUBJECT_TRANSFER',
        message: '原预算科目与调拨后预算科目相同，无需调拨',
        severity: 'WARNING'
      });
      processingNotes.push('调拨前后科目相同，无需调拨');
    }

    if (record.报销金额 <= 0) {
      if (record.报销金额 < 0 || record.退款标记 === '是') {
        recordWarnings.push({
          type: 'REFUND_RECORD',
          message: '检测到退款记录，将冲销对应预算',
          severity: 'INFO'
        });
        processingNotes.push('退款记录，执行预算冲销');
      } else {
        recordErrors.push({
          type: 'INVALID_AMOUNT',
          message: `报销金额${record.报销金额}不合法`,
          severity: 'ERROR'
        });
      }
    }

    if (record.原预算科目 && record.调拨后预算科目) {
      const isCrossDepartment = record.部门 && !record.部门.includes('总部');
      if (isCrossDepartment && !allowCrossDepartment) {
        recordWarnings.push({
          type: 'CROSS_DEPARTMENT_TRANSFER',
          message: '跨部门调拨，需要额外审批',
          severity: 'WARNING'
        });
        processingNotes.push('跨部门调拨标记');
      }
    }

    if (!record.单据状态 || record.单据状态 !== '已审批') {
      recordWarnings.push({
        type: 'UNAPPROVED_RECORD',
        message: `单据状态为"${record.单据状态}"，非已审批状态`,
        severity: 'WARNING'
      });
    }

    const hasErrors = recordErrors.length > 0;
    processedRecords.push({
      ...record,
      validationStatus: hasErrors ? 'ERROR' : 'PASS',
      processingNotes,
      recordErrors,
      recordWarnings
    });

    errors.push(...recordErrors.map(e => ({
      ...e,
      报销单号: record.报销单号,
      row: record.rowNumber,
      原预算科目: record.原预算科目,
      调拨后预算科目: record.调拨后预算科目
    })));

    warnings.push(...recordWarnings.map(w => ({
      ...w,
      报销单号: record.报销单号,
      row: record.rowNumber,
      原预算科目: record.原预算科目,
      调拨后预算科目: record.调拨后预算科目
    })));
  });

  return {
    summary: {
      total: records.length,
      valid: processedRecords.filter(r => r.validationStatus === 'PASS').length,
      error: processedRecords.filter(r => r.validationStatus === 'ERROR').length,
      warnings: warnings.length
    },
    processedRecords,
    errors,
    warnings
  };
}

module.exports = {
  validateRecords,
  VALID_BUDGET_SUBJECTS,
  DISABLED_SUBJECTS,
  VALID_DEPARTMENTS
};
