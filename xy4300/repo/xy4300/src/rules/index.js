const dayjs = require('dayjs');

const RISK_TYPES = {
  EXPIRED_INSPECTION: 'expired_inspection',
  GAS_MIXUP: 'gas_mixup',
  DUPLICATE_FLOW: 'duplicate_flow',
  MISSING_EMPTY_CYLINDER: 'missing_empty_cylinder'
};

const RISK_LEVELS = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low'
};

function checkExpiredInspection(cylinder) {
  if (!cylinder.next_inspection_date) {
    return null;
  }

  const nextInspection = dayjs(cylinder.next_inspection_date);
  const now = dayjs();
  const daysUntilExpiry = nextInspection.diff(now, 'day');

  if (daysUntilExpiry < 0) {
    return {
      riskType: RISK_TYPES.EXPIRED_INSPECTION,
      riskLevel: RISK_LEVELS.CRITICAL,
      description: `气瓶 ${cylinder.serial_number} 已过期未检，下次检验日期为 ${cylinder.next_inspection_date}，已过期 ${Math.abs(daysUntilExpiry)} 天`,
      cylinderId: cylinder.id,
      serialNumber: cylinder.serial_number,
      details: {
        nextInspectionDate: cylinder.next_inspection_date,
        daysOverdue: Math.abs(daysUntilExpiry)
      }
    };
  } else if (daysUntilExpiry <= 30) {
    return {
      riskType: RISK_TYPES.EXPIRED_INSPECTION,
      riskLevel: RISK_LEVELS.HIGH,
      description: `气瓶 ${cylinder.serial_number} 即将过期，下次检验日期为 ${cylinder.next_inspection_date}，还剩 ${daysUntilExpiry} 天`,
      cylinderId: cylinder.id,
      serialNumber: cylinder.serial_number,
      details: {
        nextInspectionDate: cylinder.next_inspection_date,
        daysRemaining: daysUntilExpiry
      }
    };
  }

  return null;
}

function checkGasMixup(cylinders, location) {
  const locationCylinders = cylinders.filter(c => c.location === location && c.status === 'in_stock');
  
  if (locationCylinders.length < 2) {
    return [];
  }

  const gasTypes = [...new Set(locationCylinders.map(c => c.gas_type))];
  
  if (gasTypes.length > 1) {
    const oxygenCylinders = locationCylinders.filter(c => c.gas_type === '氧气');
    const laughingGasCylinders = locationCylinders.filter(c => c.gas_type === '笑气');
    
    if (oxygenCylinders.length > 0 && laughingGasCylinders.length > 0) {
      return [
        {
          riskType: RISK_TYPES.GAS_MIXUP,
          riskLevel: RISK_LEVELS.CRITICAL,
          description: `位置 ${location} 存在氧气和笑气瓶混放风险，氧气: ${oxygenCylinders.length} 瓶，笑气: ${laughingGasCylinders.length} 瓶`,
          location,
          details: {
            location,
            oxygenCount: oxygenCylinders.length,
            laughingGasCount: laughingGasCylinders.length,
            oxygenSerialNumbers: oxygenCylinders.map(c => c.serial_number),
            laughingGasSerialNumbers: laughingGasCylinders.map(c => c.serial_number)
          }
        }
      ];
    }
  }

  return [];
}

async function checkDuplicateFlow(db, cylinder) {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT * FROM transactions 
      WHERE cylinder_id = ? 
      ORDER BY created_at DESC 
      LIMIT 5
    `, [cylinder.id], (err, transactions) => {
      if (err) {
        reject(err);
        return;
      }

      if (transactions.length < 2) {
        resolve(null);
        return;
      }

      const risks = [];
      let consecutiveBorrows = 0;
      let lastType = null;

      for (const tx of transactions) {
        if (tx.type === 'borrow') {
          if (lastType === 'borrow') {
            consecutiveBorrows++;
          } else {
            consecutiveBorrows = 1;
          }
          
          if (consecutiveBorrows >= 2) {
            risks.push({
              riskType: RISK_TYPES.DUPLICATE_FLOW,
              riskLevel: RISK_LEVELS.HIGH,
              description: `气瓶 ${cylinder.serial_number} 存在重复借出记录，连续 ${consecutiveBorrows} 次借出未归还`,
              cylinderId: cylinder.id,
              serialNumber: cylinder.serial_number,
              details: {
                consecutiveBorrows,
                lastTransaction: tx
              }
            });
            break;
          }
        }
        lastType = tx.type;
      }

      if (cylinder.status === 'borrowed') {
        const borrowTransactions = transactions.filter(t => t.type === 'borrow');
        const returnTransactions = transactions.filter(t => t.type === 'return');
        
        if (borrowTransactions.length > returnTransactions.length + 1) {
          risks.push({
            riskType: RISK_TYPES.DUPLICATE_FLOW,
            riskLevel: RISK_LEVELS.CRITICAL,
            description: `气瓶 ${cylinder.serial_number} 状态异常，当前状态为借出但存在多次借出记录`,
            cylinderId: cylinder.id,
            serialNumber: cylinder.serial_number,
            details: {
              borrowCount: borrowTransactions.length,
              returnCount: returnTransactions.length,
              currentStatus: cylinder.status
            }
          });
        }
      }

      resolve(risks.length > 0 ? risks[0] : null);
    });
  });
}

async function checkMissingEmptyCylinder(db, cylinder) {
  return new Promise((resolve, reject) => {
    if (cylinder.status !== 'borrowed') {
      resolve(null);
      return;
    }

    db.get(`
      SELECT * FROM transactions 
      WHERE cylinder_id = ? AND type = 'borrow' 
      ORDER BY created_at DESC 
      LIMIT 1
    `, [cylinder.id], (err, lastBorrow) => {
      if (err) {
        reject(err);
        return;
      }

      if (!lastBorrow) {
        resolve(null);
        return;
      }

      const borrowDate = dayjs(lastBorrow.created_at);
      const now = dayjs();
      const daysBorrowed = now.diff(borrowDate, 'day');

      if (daysBorrowed > 7) {
        resolve({
          riskType: RISK_TYPES.MISSING_EMPTY_CYLINDER,
          riskLevel: RISK_LEVELS.HIGH,
          description: `气瓶 ${cylinder.serial_number} 借出超过 ${daysBorrowed} 天未归还，可能为空瓶未追回`,
          cylinderId: cylinder.id,
          serialNumber: cylinder.serial_number,
          details: {
            borrowDate: lastBorrow.created_at,
            daysBorrowed,
            department: lastBorrow.department,
            person: lastBorrow.person
          }
        });
      } else {
        resolve(null);
      }
    });
  });
}

async function checkAllRisks(db, cylinder) {
  const risks = [];

  const expiredRisk = checkExpiredInspection(cylinder);
  if (expiredRisk) {
    risks.push(expiredRisk);
  }

  const duplicateRisk = await checkDuplicateFlow(db, cylinder);
  if (duplicateRisk) {
    risks.push(duplicateRisk);
  }

  const missingRisk = await checkMissingEmptyCylinder(db, cylinder);
  if (missingRisk) {
    risks.push(missingRisk);
  }

  return risks;
}

async function scanAllRisks(db) {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM cylinders WHERE status != 'scrapped'`, async (err, cylinders) => {
      if (err) {
        reject(err);
        return;
      }

      const allRisks = [];

      for (const cylinder of cylinders) {
        const risks = await checkAllRisks(db, cylinder);
        allRisks.push(...risks);
      }

      const locations = [...new Set(cylinders.filter(c => c.location).map(c => c.location))];
      for (const location of locations) {
        const mixupRisks = checkGasMixup(cylinders, location);
        allRisks.push(...mixupRisks);
      }

      resolve(allRisks);
    });
  });
}

function groupRisksByType(risks) {
  const groups = {};
  for (const risk of risks) {
    const type = risk.riskType;
    if (!groups[type]) {
      groups[type] = [];
    }
    groups[type].push(risk);
  }
  return groups;
}

function groupRisksByLevel(risks) {
  const groups = {};
  for (const risk of risks) {
    const level = risk.riskLevel;
    if (!groups[level]) {
      groups[level] = [];
    }
    groups[level].push(risk);
  }
  return groups;
}

module.exports = {
  RISK_TYPES,
  RISK_LEVELS,
  checkExpiredInspection,
  checkGasMixup,
  checkDuplicateFlow,
  checkMissingEmptyCylinder,
  checkAllRisks,
  scanAllRisks,
  groupRisksByType,
  groupRisksByLevel
};
