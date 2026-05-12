const db = require('./database');
const { v4: uuid } = require('uuid');
const { BusinessError } = require('./errors');
const models = require('./models');
const { Elder, Prescription, PillBox, Distribution, Receipt, Issue, recordIssue, recordError } = models;

const STATUS_FLOW = {
  pillBox: ['prepared', 'verifying', 'distributed', 'received', 'returned'],
  distribution: ['pending', 'verified', 'mismatch', 'completed'],
  receipt: ['pending', 'confirmed', 'rejected']
};

function matchPillBoxWithPrescription(pillBox, prescription) {
  const result = {
    matched: true,
    matchScore: 0,
    details: {
      expected: [],
      actual: [],
      mismatches: [],
      extras: [],
      missing: []
    }
  };
  
  const prescriptionMap = {};
  for (const item of prescription.items) {
    const key = `${item.medicine_name}|${item.dosage}`;
    prescriptionMap[key] = item;
    result.details.expected.push({
      medicine: item.medicine_name,
      dosage: item.dosage,
      quantity: item.quantity,
      unit: item.unit
    });
  }
  
  const pillBoxMap = {};
  for (const item of pillBox.items) {
    const key = `${item.medicine_name}|${item.dosage}`;
    pillBoxMap[key] = item;
    result.details.actual.push({
      medicine: item.medicine_name,
      dosage: item.dosage,
      quantity: item.quantity,
      unit: item.unit
    });
  }
  
  for (const key in prescriptionMap) {
    const expected = prescriptionMap[key];
    const actual = pillBoxMap[key];
    
    if (!actual) {
      result.matched = false;
      result.details.missing.push({
        medicine: expected.medicine_name,
        dosage: expected.dosage,
        expected: expected.quantity,
        actual: 0
      });
    } else {
      if (actual.quantity !== expected.quantity) {
        result.matched = false;
        result.details.mismatches.push({
          medicine: expected.medicine_name,
          dosage: expected.dosage,
          field: 'quantity',
          expected: expected.quantity,
          actual: actual.quantity
        });
      }
    }
  }
  
  for (const key in pillBoxMap) {
    if (!prescriptionMap[key]) {
      result.matched = false;
      result.details.extras.push({
        medicine: pillBoxMap[key].medicine_name,
        dosage: pillBoxMap[key].dosage,
        quantity: pillBoxMap[key].quantity
      });
    }
  }
  
  const totalItems = prescription.items.length;
  const matchedItems = prescription.items.filter(p => {
    const key = `${p.medicine_name}|${p.dosage}`;
    const actual = pillBoxMap[key];
    return actual && actual.quantity === p.quantity;
  }).length;
  
  result.matchScore = totalItems > 0 ? (matchedItems / totalItems) : 0;
  
  return result;
}

function validatePrescriptionForDate(prescription, date, sourceId) {
  const checkDate = date || new Date().toISOString().split('T')[0];
  
  if (prescription.status !== 'active') {
    const err = new BusinessError('PRESCRIPTION_INACTIVE', {
      prescriptionId: prescription.id,
      status: prescription.status,
      checkDate
    }, 'prescription', sourceId);
    recordError(err);
    throw err;
  }
  
  if (checkDate < prescription.effective_from) {
    const err = new BusinessError('PRESCRIPTION_NOT_EFFECTIVE', {
      prescriptionId: prescription.id,
      effectiveFrom: prescription.effective_from,
      checkDate
    }, 'prescription', sourceId);
    recordError(err);
    throw err;
  }
  
  if (prescription.effective_to && checkDate > prescription.effective_to) {
    const err = new BusinessError('PRESCRIPTION_EXPIRED', {
      prescriptionId: prescription.id,
      effectiveTo: prescription.effective_to,
      checkDate
    }, 'prescription', sourceId);
    recordError(err);
    throw err;
  }
  
  return true;
}

function createDistribution(data) {
  const pillBox = PillBox.get(data.pill_box_id);
  const prescription = Prescription.get(data.prescription_id);
  
  if (pillBox.elder_id !== prescription.elder_id) {
    const err = new BusinessError('PRESCRIPTION_ELDER_MISMATCH', {
      pillBoxElderId: pillBox.elder_id,
      prescriptionElderId: prescription.elder_id
    }, 'distribution', data.pill_box_id);
    recordError(err);
    throw err;
  }
  
  validatePrescriptionForDate(prescription, pillBox.intended_date, data.pill_box_id);
  
  const matchResult = matchPillBoxWithPrescription(pillBox, prescription);
  const id = uuid();
  const status = matchResult.matched ? 'verified' : 'mismatch';
  
  db.prepare(`
    INSERT INTO distributions (id, pill_box_id, prescription_id, distributor, status, match_score)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, pillBox.id, prescription.id, data.distributor || null, status, matchResult.matchScore);
  
  PillBox.updateStatus(pillBox.id, matchResult.matched ? 'distributed' : 'verifying');
  
  if (!matchResult.matched) {
    recordIssue(
      'distribution_mismatch',
      'error',
      'distribution',
      id,
      '药盒与医嘱不匹配',
      `药盒 ${pillBox.id} 与医嘱 ${prescription.id} 匹配度仅为 ${(matchResult.matchScore * 100).toFixed(0)}%`,
      {
        pillBoxId: pillBox.id,
        prescriptionId: prescription.id,
        matchScore: matchResult.matchScore,
        matchDetails: matchResult.details
      }
    );
    
    const err = new BusinessError('MEDICINE_MISMATCH', matchResult.details, 'distribution', id);
    recordError(err);
    throw err;
  }
  
  const distribution = Distribution.get(id);
  return {
    distribution,
    matchResult,
    pillBox,
    prescription
  };
}

function createReceipt(data) {
  const distribution = Distribution.get(data.distribution_id);
  const pillBox = PillBox.get(distribution.pill_box_id);
  const prescription = Prescription.get(distribution.prescription_id);
  
  if (data.elder_id && data.elder_id !== pillBox.elder_id) {
    const err = new BusinessError('RECEIPT_ELDER_MISMATCH', {
      receiptElderId: data.elder_id,
      distributionElderId: pillBox.elder_id
    }, 'receipt', distribution.id);
    recordError(err);
    throw err;
  }
  
  let actualMeds = null;
  let receiptMeds = null;
  
  if (data.actual_medicines) {
    actualMeds = typeof data.actual_medicines === 'string' 
      ? data.actual_medicines 
      : JSON.stringify(data.actual_medicines);
    
    try {
      receiptMeds = typeof data.actual_medicines === 'string'
        ? JSON.parse(data.actual_medicines)
        : data.actual_medicines;
    } catch (e) {
      receiptMeds = null;
    }
  }
  
  let receiptMatch = true;
  if (receiptMeds && Array.isArray(receiptMeds)) {
    const pillBoxMap = {};
    for (const item of pillBox.items) {
      const key = `${item.medicine_name}|${item.dosage}`;
      pillBoxMap[key] = item;
    }
    
    const receiptMap = {};
    for (const item of receiptMeds) {
      const key = `${item.medicine_name}|${item.dosage}`;
      receiptMap[key] = item;
    }
    
    for (const key in pillBoxMap) {
      if (!receiptMap[key]) {
        receiptMatch = false;
        break;
      }
    }
    
    for (const key in receiptMap) {
      if (!pillBoxMap[key]) {
        receiptMatch = false;
        break;
      }
    }
    
    if (!receiptMatch) {
      recordIssue(
        'receipt_mismatch',
        'error',
        'receipt',
        distribution.id,
        '回执药品与分发不匹配',
        '服药回执中的药品清单与实际分发药盒不一致',
        {
          distributionId: distribution.id,
          expected: pillBox.items,
          actual: receiptMeds
        }
      );
      
      const err = new BusinessError('RECEIPT_MEDICINE_MISMATCH', {
        expected: pillBox.items,
        actual: receiptMeds
      }, 'receipt', distribution.id);
      recordError(err);
      throw err;
    }
  }
  
  const receiptStatus = receiptMatch ? 'confirmed' : 'rejected';
  const id = uuid();
  
  db.prepare(`
    INSERT INTO receipts (id, distribution_id, receipt_type, received_by, actual_medicines, notes, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, distribution.id, data.receipt_type || 'self', data.received_by || null, actualMeds, data.notes || null, receiptStatus);
  
  db.prepare('UPDATE distributions SET status = ? WHERE id = ?').run('completed', distribution.id);
  db.prepare('UPDATE pill_boxes SET status = ? WHERE id = ?').run('received', pillBox.id);
  
  return {
    receipt: Receipt.get(id),
    distribution: Distribution.get(distribution.id),
    pillBox: PillBox.get(pillBox.id)
  };
}

function getMatchingSummary(pillBoxId) {
  const pillBox = PillBox.get(pillBoxId);
  const distributions = Distribution.listByPillBox(pillBoxId);
  
  if (distributions.length === 0) {
    try {
      const prescription = Prescription.getActiveForElder(pillBox.elder_id, pillBox.intended_date);
      const matchResult = matchPillBoxWithPrescription(pillBox, prescription);
      
      return {
        pillBox,
        prescription,
        matchResult,
        canDistribute: matchResult.matched,
        distributions: []
      };
    } catch (err) {
      return {
        pillBox,
        prescription: null,
        matchResult: null,
        canDistribute: false,
        distributions: [],
        error: err.code,
        errorDetails: err.details
      };
    }
  }
  
  const latestDist = distributions[0];
  const prescription = Prescription.get(latestDist.prescription_id);
  const matchResult = matchPillBoxWithPrescription(pillBox, prescription);
  
  return {
    pillBox,
    prescription,
    matchResult,
    canDistribute: matchResult.matched,
    distributions
  };
}

function getRelevantIssues(elderId = null) {
  let issues;
  if (elderId) {
    const elder = Elder.get(elderId);
    const prescriptions = db.prepare('SELECT id FROM prescriptions WHERE elder_id = ?').all(elderId).map(p => p.id);
    const pillBoxes = db.prepare('SELECT id FROM pill_boxes WHERE elder_id = ?').all(elderId).map(b => b.id);
    
    const placeholders = ['?', ...prescriptions.map(() => '?'), ...pillBoxes.map(() => '?')].join(',');
    issues = db.prepare(`
      SELECT * FROM issues 
      WHERE status = 'open'
        AND (source_id = ? OR source_id IN (${placeholders}))
      ORDER BY created_at DESC
    `).all(elderId, elderId, ...prescriptions, ...pillBoxes);
  } else {
    issues = Issue.list('open');
  }
  
  return issues;
}

module.exports = {
  STATUS_FLOW,
  matchPillBoxWithPrescription,
  validatePrescriptionForDate,
  createDistribution,
  createReceipt,
  getMatchingSummary,
  getRelevantIssues
};
