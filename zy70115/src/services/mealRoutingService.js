const db = require('../config/database');
const { logProcessStep, STEPS } = require('./processLogService');

function getClassesWithAllergenInfo() {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT c.*, s.name as school_name, s.address as school_address,
             (SELECT GROUP_CONCAT(allergen_type, ',') FROM allergen_rules 
              WHERE (school_id = s.id OR class_id = c.id) AND status = 'active') as allergens
      FROM classes c
      JOIN schools s ON c.school_id = s.id
    `, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function getSchoolRoute(schoolId) {
  return new Promise((resolve, reject) => {
    db.get(`
      SELECT dr.*, rs.order_no, rs.estimated_arrival
      FROM delivery_routes dr
      JOIN route_stops rs ON dr.id = rs.route_id
      WHERE rs.school_id = ? AND dr.status = 'active'
    `, [schoolId], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function checkAllergenCompatibility(classId, menuAllergens = []) {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT ar.*, s.name as school_name, c.name as class_name
      FROM allergen_rules ar
      LEFT JOIN schools s ON ar.school_id = s.id
      LEFT JOIN classes c ON ar.class_id = c.id
      WHERE (ar.class_id = ? OR ar.school_id = (SELECT school_id FROM classes WHERE id = ?))
        AND ar.status = 'active'
    `, [classId, classId], (err, rules) => {
      if (err) return reject(err);
      
      const classAllergens = rules.map(r => r.allergen_type);
      const conflicts = menuAllergens.filter(m => classAllergens.includes(m));
      
      resolve({
        classId,
        classAllergens,
        menuAllergens,
        conflicts,
        isCompatible: conflicts.length === 0,
        details: rules
      });
    });
  });
}

function checkRouteCapacity(routeId, requiredMeals) {
  return new Promise((resolve, reject) => {
    db.get(`
      SELECT dr.*,
             (SELECT COALESCE(SUM(meal_count), 0) FROM meal_plan_items 
              WHERE route_id = dr.id AND status IN ('approved', 'allocated')) as allocated_meals
      FROM delivery_routes dr
      WHERE dr.id = ?
    `, [routeId], (err, route) => {
      if (err) return reject(err);
      if (!route) return resolve(null);
      
      const available = route.max_capacity - (route.allocated_meals || 0);
      resolve({
        route,
        requiredMeals,
        allocatedMeals: route.allocated_meals || 0,
        availableCapacity: available,
        canAccommodate: available >= requiredMeals
      });
    });
  });
}

async function matchMealToRoute(classId, mealCount, menuAllergens = [], operator = 'system') {
  const classInfo = await new Promise((resolve, reject) => {
    db.get(`
      SELECT c.*, s.name as school_name
      FROM classes c JOIN schools s ON c.school_id = s.id
      WHERE c.id = ?
    `, [classId], (err, row) => err ? reject(err) : resolve(row));
  });

  if (!classInfo) {
    throw new Error('班级不存在');
  }

  const schoolId = classInfo.school_id;
  const route = await getSchoolRoute(schoolId);

  if (!route) {
    return {
      success: false,
      message: '该学校未分配配送线路',
      classInfo,
      allergenCheck: null,
      routeCheck: null
    };
  }

  const allergenCheck = await checkAllergenCompatibility(classId, menuAllergens);
  const routeCheck = await checkRouteCapacity(route.id, mealCount);

  const allPassed = allergenCheck.isCompatible && routeCheck && routeCheck.canAccommodate;

  return {
    success: allPassed,
    message: allPassed ? '所有校验通过，可配餐' : '存在不通过的校验项',
    classInfo,
    route: route,
    allergenCheck,
    routeCheck,
    checks: {
      allergen: {
        passed: allergenCheck.isCompatible,
        message: allergenCheck.isCompatible ? '过敏源校验通过' : `过敏源冲突: ${allergenCheck.conflicts.join(', ')}`
      },
      route: {
        passed: routeCheck ? routeCheck.canAccommodate : false,
        message: routeCheck ? 
          (routeCheck.canAccommodate ? 
            `线路容量充足(剩余${routeCheck.availableCapacity}份/线路${routeCheck.route.max_capacity}份)` : 
            `线路容量不足(需要${mealCount}份，剩余${routeCheck.availableCapacity}份)`) :
          '未找到线路信息'
      },
      studentCount: {
        passed: mealCount > 0,
        message: `配餐人数: ${mealCount}人 (班级基准${classInfo.student_count + classInfo.teacher_count}人)`
      }
    }
  };
}

async function createMealPlan(planDate, notes, operator) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO meal_plans (plan_date, status, total_meals, notes, created_at) VALUES (?, 'draft', 0, ?, datetime('now'))`,
      [planDate, notes],
      async function(err) {
        if (err) return reject(err);
        const planId = this.lastID;
        await logProcessStep(planId, '配餐计划创建', 'completed', `配餐计划创建成功，日期: ${planDate}`, operator, { planDate, notes });
        resolve({ id: planId, planDate, notes });
      }
    );
  });
}

async function addMealPlanItem(planId, classId, mealCount, menuAllergens = [], operator) {
  const result = await matchMealToRoute(classId, mealCount, menuAllergens, operator);
  
  if (!result.classInfo) {
    throw new Error('班级信息获取失败');
  }

  const status = result.success ? 'allocated' : 'pending_review';
  const routeId = result.route ? result.route.id : null;

  await new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO meal_plan_items (meal_plan_id, class_id, school_id, route_id, meal_count, allergen_checked, route_checked, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [planId, classId, result.classInfo.school_id, routeId, mealCount, 
       result.allergenCheck.isCompatible ? 1 : 0, 
       result.routeCheck && result.routeCheck.canAccommodate ? 1 : 0,
       status],
      err => err ? reject(err) : resolve()
    );
  });

  return {
    ...result,
    planId,
    classId,
    mealCount,
    itemStatus: status
  };
}

async function validateAllergenRules(planId, operator) {
  const items = await new Promise((resolve, reject) => {
    db.all(`
      SELECT mpi.*, s.name as school_name, c.name as class_name
      FROM meal_plan_items mpi
      JOIN schools s ON mpi.school_id = s.id
      JOIN classes c ON mpi.class_id = c.id
      WHERE mpi.meal_plan_id = ?
    `, [planId], (err, rows) => err ? reject(err) : resolve(rows));
  });

  if (items.length === 0) {
    const result = { success: false, message: '配餐计划为空，没有班级项目', items: [] };
    await logProcessStep(planId, '过敏源规则校验', 'rejected', result.message, operator, { itemCount: 0 });
    return result;
  }

  const results = [];
  let allPassed = true;

  for (const item of items) {
    const check = await checkAllergenCompatibility(item.class_id, []);
    allPassed = allPassed && check.isCompatible;
    
    results.push({
      itemId: item.id,
      class: `${item.school_name} - ${item.class_name}`,
      mealCount: item.meal_count,
      classAllergens: check.classAllergens,
      conflicts: check.conflicts,
      passed: check.isCompatible
    });
  }

  const status = allPassed ? 'completed' : 'rejected';
  const message = allPassed ? 
    `全部${items.length}个班级过敏源校验通过` : 
    `存在${results.filter(r => !r.passed).length}个班级过敏源冲突`;

  await logProcessStep(planId, '过敏源规则校验', status, message, operator, { results });

  return {
    success: allPassed,
    message,
    totalItems: items.length,
    passedCount: results.filter(r => r.passed).length,
    failedCount: results.filter(r => !r.passed).length,
    details: results
  };
}

module.exports = {
  getClassesWithAllergenInfo,
  getSchoolRoute,
  checkAllergenCompatibility,
  checkRouteCapacity,
  matchMealToRoute,
  createMealPlan,
  addMealPlanItem,
  validateAllergenRules
};
