const db = require('../utils/db-helper');

const VALID_STATUSES = ['pending', 'validating', 'approved', 'allocated', 'in_transit', 'completed', 'cancelled', 'rejected'];
const STATUS_TRANSITIONS = {
  pending: ['validating', 'cancelled'],
  validating: ['approved', 'rejected'],
  approved: ['allocated', 'cancelled'],
  allocated: ['in_transit', 'cancelled'],
  in_transit: ['completed'],
  completed: [],
  cancelled: [],
  rejected: []
};

function validateStatusTransition(fromStatus, toStatus) {
  const allowed = STATUS_TRANSITIONS[fromStatus] || [];
  return allowed.includes(toStatus);
}

function canCoexist(isolation1, isolation2) {
  if (!isolation1 || !isolation2) return true;
  if (isolation1.id === isolation2.id) return true;
  
  const canCoexist1 = isolation1.can_coexist_with ? isolation1.can_coexist_with.split(',').map(s => s.trim()) : [];
  const canCoexist2 = isolation2.can_coexist_with ? isolation2.can_coexist_with.split(',').map(s => s.trim()) : [];
  
  return canCoexist1.includes(isolation2.code) || canCoexist2.includes(isolation1.code);
}

async function findSuitableCage(animal) {
  const rules = [];

  rules.push({
    rule: 'strain_match',
    description: '笼位品系必须与动物品系一致或为空',
    required: true
  });

  rules.push({
    rule: 'gender_match',
    description: '笼位性别必须与动物性别一致或为空',
    required: true
  });

  rules.push({
    rule: 'isolation_compatible',
    description: '笼位隔离级别必须与动物隔离要求兼容',
    required: true
  });

  rules.push({
    rule: 'capacity_available',
    description: '笼位必须有剩余容量',
    required: true
  });

  rules.push({
    rule: 'cage_available',
    description: '笼位状态必须为可用或已占用但未满',
    required: true
  });

  const query = `
    SELECT c.*, 
           s.code as strain_code, s.name as strain_name,
           ir.code as isolation_code, ir.name as isolation_name, ir.level as isolation_level, ir.can_coexist_with as isolation_can_coexist
    FROM cages c
    LEFT JOIN strains s ON c.strain_id = s.id
    LEFT JOIN isolation_rules ir ON c.isolation_rule_id = ir.id
    WHERE c.status IN ('available', 'occupied')
    AND c.current_occupancy < c.max_capacity
  `;

  const suitableCages = await db.all(query);

  const animalIsolation = animal.isolation_rule_id ? 
    await db.get('SELECT * FROM isolation_rules WHERE id = ?', [animal.isolation_rule_id]) : null;

  const scoredCages = suitableCages.map(cage => {
    let score = 0;
    const validations = [];

    let strainMatch = false;
    if (!cage.strain_id || cage.strain_id === animal.strain_id) {
      strainMatch = true;
      score += 30;
      validations.push({ rule: 'strain_match', passed: true, message: '品系匹配' });
    } else {
      validations.push({ rule: 'strain_match', passed: false, message: '品系不匹配' });
    }

    let genderMatch = false;
    if (!cage.gender || cage.gender === animal.gender) {
      genderMatch = true;
      score += 30;
      validations.push({ rule: 'gender_match', passed: true, message: '性别匹配' });
    } else {
      validations.push({ rule: 'gender_match', passed: false, message: '性别不匹配' });
    }

    let isolationCompatible = false;
    if (!cage.isolation_rule_id || !animal.isolation_rule_id) {
      isolationCompatible = true;
      score += 30;
      validations.push({ rule: 'isolation_compatible', passed: true, message: '隔离要求兼容' });
    } else {
      const cageIsolation = {
        id: cage.isolation_rule_id,
        code: cage.isolation_code,
        can_coexist_with: cage.isolation_can_coexist
      };
      if (canCoexist(cageIsolation, animalIsolation)) {
        isolationCompatible = true;
        score += 30;
        validations.push({ rule: 'isolation_compatible', passed: true, message: '隔离要求兼容' });
      } else {
        validations.push({ rule: 'isolation_compatible', passed: false, message: '隔离要求不兼容' });
      }
    }

    const hasCapacity = cage.current_occupancy < cage.max_capacity;
    if (hasCapacity) {
      score += 10;
      validations.push({ rule: 'capacity_available', passed: true, message: '有剩余容量' });
    } else {
      validations.push({ rule: 'capacity_available', passed: false, message: '容量已满' });
    }

    const isAvailable = cage.status === 'available' || cage.status === 'occupied';
    if (isAvailable) {
      score += 5;
      validations.push({ rule: 'cage_available', passed: true, message: '笼位可用' });
    } else {
      validations.push({ rule: 'cage_available', passed: false, message: '笼位不可用' });
    }

    const allPassed = strainMatch && genderMatch && isolationCompatible && hasCapacity && isAvailable;

    return {
      cage,
      score,
      validations,
      suitable: allPassed
    };
  }).filter(item => item.suitable)
    .sort((a, b) => b.score - a.score);

  if (scoredCages.length === 0) {
    return {
      success: false,
      message: '未找到符合条件的笼位',
      rules,
      validationDetails: []
    };
  }

  const bestMatch = scoredCages[0];
  
  return {
    success: true,
    cage: bestMatch.cage,
    score: bestMatch.score,
    rules,
    validations: bestMatch.validations
  };
}

async function validateTransfer(animalId, targetCageId) {
  const animal = await db.get(`
    SELECT a.*, s.code as strain_code, s.name as strain_name,
           ir.code as isolation_code, ir.name as isolation_name
    FROM animals a
    LEFT JOIN strains s ON a.strain_id = s.id
    LEFT JOIN isolation_rules ir ON a.isolation_rule_id = ir.id
    WHERE a.id = ?
  `, [animalId]);

  if (!animal) {
    return { success: false, message: '动物不存在' };
  }

  const currentAllocation = await db.get(`
    SELECT a.*, c.code as cage_code
    FROM allocations a
    LEFT JOIN cages c ON a.cage_id = c.id
    WHERE a.animal_id = ? AND a.status IN ('allocated', 'in_transit', 'completed')
    ORDER BY a.created_at DESC
    LIMIT 1
  `, [animalId]);

  if (!currentAllocation) {
    return {
      success: false,
      message: '动物当前没有分配记录，无法转笼',
      code: 'NO_CURRENT_ALLOCATION'
    };
  }

  if (!currentAllocation.cage_id) {
    return {
      success: false,
      message: '动物当前笼位信息不完整',
      code: 'INCOMPLETE_ALLOCATION'
    };
  }

  const targetCage = await db.get(`
    SELECT c.*, s.code as strain_code, s.name as strain_name,
           ir.code as isolation_code, ir.name as isolation_name, ir.level as isolation_level, ir.can_coexist_with as isolation_can_coexist
    FROM cages c
    LEFT JOIN strains s ON c.strain_id = s.id
    LEFT JOIN isolation_rules ir ON c.isolation_rule_id = ir.id
    WHERE c.id = ?
  `, [targetCageId]);

  if (!targetCage) {
    return { success: false, message: '目标笼位不存在' };
  }

  if (currentAllocation.cage_id === targetCageId) {
    return {
      success: false,
      message: '目标笼位与当前笼位相同',
      code: 'SAME_CAGE'
    };
  }

  const validations = [];

  if (targetCage.strain_id && targetCage.strain_id !== animal.strain_id) {
    validations.push({
      rule: 'strain_match',
      passed: false,
      message: `目标笼位品系(${targetCage.strain_code})与动物品系(${animal.strain_code})不匹配`
    });
  } else {
    validations.push({
      rule: 'strain_match',
      passed: true,
      message: '品系检查通过'
    });
  }

  if (targetCage.gender && targetCage.gender !== animal.gender) {
    validations.push({
      rule: 'gender_match',
      passed: false,
      message: `目标笼位性别(${targetCage.gender})与动物性别(${animal.gender})不匹配`
    });
  } else {
    validations.push({
      rule: 'gender_match',
      passed: true,
      message: '性别检查通过'
    });
  }

  if (targetCage.isolation_rule_id && animal.isolation_rule_id) {
    const targetIso = {
      id: targetCage.isolation_rule_id,
      code: targetCage.isolation_code,
      can_coexist_with: targetCage.isolation_can_coexist
    };
    const animalIsoResult = await db.get('SELECT can_coexist_with FROM isolation_rules WHERE id = ?', [animal.isolation_rule_id]);
    const animalIso = {
      id: animal.isolation_rule_id,
      code: animal.isolation_code,
      can_coexist_with: animalIsoResult?.can_coexist_with
    };
    
    if (!canCoexist(targetIso, animalIso)) {
      validations.push({
        rule: 'isolation_compatible',
        passed: false,
        message: `目标笼位隔离级别(${targetCage.isolation_name})与动物隔离要求(${animal.isolation_name})不兼容，可能存在违规风险`
      });
    } else {
      validations.push({
        rule: 'isolation_compatible',
        passed: true,
        message: '隔离兼容性检查通过'
      });
    }
  } else {
    validations.push({
      rule: 'isolation_compatible',
      passed: true,
      message: '隔离兼容性检查通过'
    });
  }

  if (targetCage.current_occupancy >= targetCage.max_capacity) {
    validations.push({
      rule: 'capacity_available',
      passed: false,
      message: `目标笼位容量已满(${targetCage.current_occupancy}/${targetCage.max_capacity})`
    });
  } else {
    validations.push({
      rule: 'capacity_available',
      passed: true,
      message: `目标笼位容量充足(${targetCage.current_occupancy}/${targetCage.max_capacity})`
    });
  }

  const allPassed = validations.every(v => v.passed);

  if (!allPassed) {
    return {
      success: false,
      message: '转笼验证失败，存在违规风险',
      code: 'TRANSFER_VALIDATION_FAILED',
      currentCage: {
        id: currentAllocation.cage_id,
        code: currentAllocation.cage_code
      },
      targetCage: {
        id: targetCage.id,
        code: targetCage.code
      },
      validations,
      warning: '临时转笼容易违反品系、性别和隔离规则，请确认是否继续'
    };
  }

  return {
    success: true,
    message: '转笼验证通过',
    currentCage: {
      id: currentAllocation.cage_id,
      code: currentAllocation.cage_code
    },
    targetCage: {
      id: targetCage.id,
      code: targetCage.code
    },
    validations
  };
}

module.exports = {
  VALID_STATUSES,
  STATUS_TRANSITIONS,
  validateStatusTransition,
  findSuitableCage,
  validateTransfer
};
