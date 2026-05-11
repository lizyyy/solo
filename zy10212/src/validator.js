const { generateId, now } = require('./utils');
const store = require('./store');

const ANOMALY_TYPES = {
  NEGATIVE_INVENTORY: 'negative_inventory',
  UNAPPROVED_REISSUE: 'unapproved_reissue',
  UNREFUNDED_COURSE: 'unrefunded_course',
  SPEC_MISMATCH: 'spec_mismatch',
  DUPLICATE_TRANSACTION: 'duplicate_transaction'
};

function detectAnomalies(storeType = 'pending') {
  const anomalies = [];

  anomalies.push(...checkNegativeInventory(storeType));
  anomalies.push(...checkUnapprovedReissue(storeType));
  anomalies.push(...checkUnrefundedCourse(storeType));
  anomalies.push(...checkSpecMismatch(storeType));
  anomalies.push(...checkDuplicateTransaction(storeType));

  return anomalies;
}

function checkNegativeInventory(storeType) {
  const anomalies = [];
  const transactions = store.getTransactions(storeType);
  const specs = store.getSpecs(storeType);

  const allInventoryMap = {};
  specs.forEach(s => {
    allInventoryMap[s.id] = 0;
  });
  transactions.forEach(t => {
    if (!allInventoryMap[t.specId]) allInventoryMap[t.specId] = 0;
    allInventoryMap[t.specId] += t.quantity;
  });

  specs.forEach(spec => {
    const qty = allInventoryMap[spec.id] || 0;
    if (qty < 0) {
      anomalies.push({
        id: generateId('A'),
        type: ANOMALY_TYPES.NEGATIVE_INVENTORY,
        specId: spec.id,
        specName: spec.name,
        severity: 'high',
        description: `规格[${spec.name}]确认后库存将为负数: ${qty}${spec.unit}`,
        status: 'open',
        createdAt: now()
      });
    }
  });

  return anomalies;
}

function checkUnapprovedReissue(storeType) {
  const anomalies = [];
  const transactions = store.getTransactions(storeType);

  const reissues = transactions.filter(
    t => t.type === 'reissue'
  );

  reissues.forEach(t => {
    if (!t.approvedBy || !t.approvedAt) {
      anomalies.push({
        id: generateId('A'),
        type: ANOMALY_TYPES.UNAPPROVED_REISSUE,
        transactionId: t.id,
        studentId: t.studentId,
        studentName: t.studentName,
        specId: t.specId,
        severity: 'high',
        description: `补发记录[${t.id}]没有审批信息 (状态: ${t.status})`,
        status: 'open',
        createdAt: now()
      });
    }
  });

  return anomalies;
}

function checkUnrefundedCourse(storeType) {
  const anomalies = [];
  const transactions = store.getTransactions(storeType);
  const courses = store.getCourses(storeType);

  const cancelledCourses = courses.filter(c => c.status === 'cancelled');
  const cancelledCourseIds = new Set(cancelledCourses.map(c => c.id));

  const issues = transactions.filter(
    t => t.type === 'issue' && t.courseId
  );

  issues.forEach(t => {
    if (cancelledCourseIds.has(t.courseId)) {
      const refunds = transactions.filter(
        r =>
          r.type === 'refund' &&
          r.studentId === t.studentId &&
          r.specId === t.specId &&
          r.courseId === t.courseId
      );

      const refundedQty = refunds.reduce((sum, r) => sum + r.quantity, 0);
      const issuedQty = t.quantity * -1;

      if (refundedQty < issuedQty) {
        anomalies.push({
          id: generateId('A'),
          type: ANOMALY_TYPES.UNREFUNDED_COURSE,
          transactionId: t.id,
          studentId: t.studentId,
          studentName: t.studentName,
          specId: t.specId,
          courseId: t.courseId,
          severity: 'high',
          description: `学生[${t.studentName}]已取消课程[${t.courseId}]的发放未完全退费: 发放${issuedQty}, 退费${refundedQty}`,
          status: 'open',
          createdAt: now()
        });
      }
    }
  });

  return anomalies;
}

function checkSpecMismatch(storeType) {
  const anomalies = [];
  const specs = store.getSpecs(storeType);
  const specIds = new Set(specs.map(s => s.id));
  const transactions = store.getTransactions(storeType);

  transactions.forEach(t => {
    if (t.specId && !specIds.has(t.specId)) {
      anomalies.push({
        id: generateId('A'),
        type: ANOMALY_TYPES.SPEC_MISMATCH,
        transactionId: t.id,
        specId: t.specId,
        severity: 'medium',
        description: `交易[${t.id}]引用了不存在的规格[${t.specId}]`,
        status: 'open',
        createdAt: now()
      });
    }
  });

  return anomalies;
}

function checkDuplicateTransaction(storeType) {
  const anomalies = [];
  const transactions = store.getTransactions(storeType);

  const keyed = {};
  transactions.forEach(t => {
    const key = `${t.type}|${t.studentId || 'N/A'}|${t.specId}|${t.quantity}|${t.courseId || 'N/A'}|${t.importSourceFile || 'N/A'}`;
    if (!keyed[key]) {
      keyed[key] = [];
    }
    keyed[key].push(t);
  });

  Object.entries(keyed).forEach(([key, items]) => {
    if (items.length > 1) {
      items.slice(1).forEach((t, idx) => {
        anomalies.push({
          id: generateId('A'),
          type: ANOMALY_TYPES.DUPLICATE_TRANSACTION,
          transactionId: t.id,
          originalTransactionId: items[0].id,
          studentId: t.studentId,
          specId: t.specId,
          severity: 'medium',
          description: `检测到疑似重复交易: [${t.id}] 可能是 [${items[0].id}] 的重复导入`,
          status: 'open',
          createdAt: now()
        });
      });
    }
  });

  return anomalies;
}

function validateIssue(storeType, specId, quantity) {
  const errors = [];

  const spec = store.getSpecById(storeType, specId);
  if (!spec) {
    errors.push(`规格不存在: ${specId}`);
    return { valid: false, errors };
  }

  if (!quantity || quantity <= 0 || !Number.isInteger(quantity)) {
    errors.push('发放数量必须是正整数');
    return { valid: false, errors };
  }

  const transactions = store.getTransactions(storeType);
  const pendingIssues = transactions.filter(
    t => (t.type === 'issue' || t.type === 'reissue') && 
         t.specId === specId && 
         t.status === 'pending'
  ).reduce((sum, t) => sum + Math.abs(t.quantity), 0);

  const inventory = store.computeCurrentInventory(storeType);
  const inv = inventory.find(i => i.specId === specId);
  const confirmedQty = inv ? inv.quantity : 0;

  const availableQty = confirmedQty - pendingIssues;

  if (availableQty - quantity < 0) {
    errors.push(`库存不足: 已确认库存${confirmedQty}${spec.unit}, 待确认发放${pendingIssues}${spec.unit}, 可用${availableQty}${spec.unit}, 本次申请${quantity}${spec.unit}`);
  }

  return { valid: errors.length === 0, errors };
}

function validateRefund(storeType, studentId, specId, quantity, courseId) {
  const errors = [];

  const spec = store.getSpecById(storeType, specId);
  if (!spec) {
    errors.push(`规格不存在: ${specId}`);
    return { valid: false, errors };
  }

  if (!quantity || quantity <= 0 || !Number.isInteger(quantity)) {
    errors.push('退费数量必须是正整数');
    return { valid: false, errors };
  }

  const transactions = store.getTransactionsByStudent(storeType, studentId);
  const issues = transactions.filter(
    t => t.type === 'issue' &&
         t.specId === specId &&
         (!courseId || t.courseId === courseId)
  );

  const totalIssued = issues.reduce((sum, t) => sum + (t.quantity * -1), 0);
  const refunds = transactions.filter(
    t => t.type === 'refund' &&
         t.specId === specId &&
         (!courseId || t.courseId === courseId)
  );
  const totalRefunded = refunds.reduce((sum, t) => sum + t.quantity, 0);

  if (totalRefunded + quantity > totalIssued) {
    errors.push(`退费数量超过已发放数量: 已发放${totalIssued}, 已退费${totalRefunded}, 申请${quantity}`);
  }

  return { valid: errors.length === 0, errors };
}

module.exports = {
  ANOMALY_TYPES,
  detectAnomalies,
  validateIssue,
  validateRefund
};
