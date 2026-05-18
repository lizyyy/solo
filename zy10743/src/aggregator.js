const { DISABLED_SUBJECTS } = require('./validator');

function calculateBudgetOccupancy(validatedRecords, initialBudgets = {}) {
  const subjectSummary = {};
  const departmentSummary = {};
  const transferRecords = [];
  const skippedRecords = [];

  VALID_BUDGET_SUBJECTS.forEach(subject => {
    subjectSummary[subject] = {
      原预算占用: initialBudgets[subject] || 0,
      调入金额: 0,
      调出金额: 0,
      冲销金额: 0,
      调拨后占用: initialBudgets[subject] || 0,
      记录数: 0
    };
  });

  validatedRecords.forEach(record => {
    const isRefund = record.报销金额 < 0 || record.退款标记 === '是';
    const isDisabledSubject = DISABLED_SUBJECTS.includes(record.调拨后预算科目);
    const isSameSubject = record.原预算科目 === record.调拨后预算科目;
    const isValid = record.validationStatus === 'PASS';

    if (!isValid) {
      skippedRecords.push({
        ...record,
        skipReason: '校验不通过，跳过处理'
      });
      return;
    }

    if (isDisabledSubject) {
      skippedRecords.push({
        ...record,
        skipReason: '调拨后科目已停用，跳过调拨'
      });
      return;
    }

    if (isSameSubject) {
      skippedRecords.push({
        ...record,
        skipReason: '调拨前后科目相同，无需调拨'
      });
      return;
    }

    const amount = Math.abs(record.报销金额);
    const transferType = isRefund ? '退款冲销' : '正常调拨';

    if (subjectSummary[record.原预算科目]) {
      if (isRefund) {
        subjectSummary[record.原预算科目].冲销金额 += amount;
        subjectSummary[record.原预算科目].调拨后占用 -= amount;
      } else {
        subjectSummary[record.原预算科目].调出金额 += amount;
        subjectSummary[record.原预算科目].调拨后占用 -= amount;
      }
      subjectSummary[record.原预算科目].记录数 += 1;
    }

    if (subjectSummary[record.调拨后预算科目]) {
      if (isRefund) {
        subjectSummary[record.调拨后预算科目].冲销金额 += amount;
        subjectSummary[record.调拨后预算科目].调拨后占用 -= amount;
      } else {
        subjectSummary[record.调拨后预算科目].调入金额 += amount;
        subjectSummary[record.调拨后预算科目].调拨后占用 += amount;
      }
      subjectSummary[record.调拨后预算科目].记录数 += 1;
    }

    if (!departmentSummary[record.部门]) {
      departmentSummary[record.部门] = {
        总调拨金额: 0,
        记录数: 0,
        科目分布: {}
      };
    }
    departmentSummary[record.部门].总调拨金额 += amount;
    departmentSummary[record.部门].记录数 += 1;
    
    const deptSubject = departmentSummary[record.部门].科目分布;
    deptSubject[record.调拨后预算科目] = (deptSubject[record.调拨后预算科目] || 0) + amount;

    transferRecords.push({
      报销单号: record.报销单号,
      申请人: record.申请人,
      部门: record.部门,
      原预算科目: record.原预算科目,
      调拨后预算科目: record.调拨后预算科目,
      调拨金额: amount,
      调拨类型: transferType,
      处理状态: '已处理',
      处理备注: record.processingNotes.join('; ') || '正常完成调拨复算'
    });
  });

  return {
    subjectSummary,
    departmentSummary,
    transferRecords,
    skippedRecords,
    statistics: {
      totalRecords: validatedRecords.length,
      processedRecords: transferRecords.length,
      skippedRecords: skippedRecords.length,
      refundRecords: transferRecords.filter(r => r.调拨类型 === '退款冲销').length,
      totalTransferAmount: transferRecords.reduce((sum, r) => sum + r.调拨金额, 0),
      totalRefundAmount: transferRecords.filter(r => r.调拨类型 === '退款冲销').reduce((sum, r) => sum + r.调拨金额, 0)
    }
  };
}

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

function recalculateAll(records, options = {}) {
  const { initialBudgets = {} } = options;
  
  const occupancy = calculateBudgetOccupancy(records, initialBudgets);
  
  const subjectChanges = Object.entries(occupancy.subjectSummary).map(([subject, data]) => ({
    预算科目: subject,
    原预算占用: data.原预算占用,
    调入金额: data.调入金额,
    调出金额: data.调出金额,
    冲销金额: data.冲销金额,
    调拨后占用: data.调拨后占用,
    净变动: data.调拨后占用 - data.原预算占用,
    记录数: data.记录数
  }));

  return {
    ...occupancy,
    subjectChanges,
    runTimestamp: new Date().toISOString(),
    runId: `RECALC_${Date.now()}`
  };
}

module.exports = {
  calculateBudgetOccupancy,
  recalculateAll,
  VALID_BUDGET_SUBJECTS
};
