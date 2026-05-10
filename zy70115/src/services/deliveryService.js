const db = require('../config/database');
const { logProcessStep } = require('./processLogService');

function getRouteMealsForPlan(mealPlanId, routeId) {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT mpi.*, s.name as school_name, c.name as class_name
      FROM meal_plan_items mpi
      JOIN schools s ON mpi.school_id = s.id
      JOIN classes c ON mpi.class_id = c.id
      WHERE mpi.meal_plan_id = ? AND mpi.route_id = ? AND mpi.status = 'allocated'
    `, [mealPlanId, routeId], (err, rows) => err ? reject(err) : resolve(rows));
  });
}

async function createRouteLoad(mealPlanId, routeId, loadedBy) {
  const routeItems = await getRouteMealsForPlan(mealPlanId, routeId);
  const totalMeals = routeItems.reduce((sum, item) => sum + item.meal_count, 0);

  if (routeItems.length === 0) {
    return {
      success: false,
      message: '该线路当前无已分配的配餐项目'
    };
  }

  const loadId = await new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO route_loads (meal_plan_id, route_id, total_meals, loaded_by, load_time, status, created_at)
       VALUES (?, ?, ?, ?, datetime('now'), 'in_progress', datetime('now'))`,
      [mealPlanId, routeId, totalMeals, loadedBy],
      function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });

  for (const item of routeItems) {
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO route_load_items (route_load_id, meal_plan_item_id, loaded_count) VALUES (?, ?, ?)`,
        [loadId, item.id, item.meal_count],
        err => err ? reject(err) : resolve()
      );
    });
  }

  await logProcessStep(
    mealPlanId,
    '线路装载确认',
    'in_progress',
    `线路装载开始，共${routeItems.length}个班级，${totalMeals}份餐`,
    loadedBy,
    { routeId, loadId, itemCount: routeItems.length, totalMeals }
  );

  return {
    success: true,
    message: '线路装载已创建',
    loadId,
    routeId,
    totalMeals,
    items: routeItems.map(item => ({
      itemId: item.id,
      school: item.school_name,
      class: item.class_name,
      loadedCount: item.meal_count
    }))
  };
}

async function confirmRouteLoad(loadId, confirmedBy) {
  const load = await new Promise((resolve, reject) => {
    db.get('SELECT * FROM route_loads WHERE id = ?', [loadId], 
      (err, row) => err ? reject(err) : resolve(row));
  });

  if (!load) {
    throw new Error('装载记录不存在');
  }

  await new Promise((resolve, reject) => {
    db.run(
      `UPDATE route_loads SET status = 'completed', confirmed_by = ?, confirmed_at = datetime('now') WHERE id = ?`,
      [confirmedBy, loadId],
      err => err ? reject(err) : resolve()
    );
  });

  await logProcessStep(
    load.meal_plan_id,
    '线路装载确认',
    'completed',
    `线路装载已确认，共${load.total_meals}份餐`,
    confirmedBy,
    { loadId, routeId: load.route_id, totalMeals: load.total_meals }
  );

  return {
    success: true,
    message: '线路装载已确认完成',
    loadId,
    totalMeals: load.total_meals
  };
}

function createDeliveryReceipt(loadId, schoolId, receivedBy, receivedCount, condition, signature) {
  return new Promise(async (resolve, reject) => {
    const load = await new Promise((res, rej) => {
      db.get('SELECT * FROM route_loads WHERE id = ?', [loadId], 
        (err, row) => err ? rej(err) : res(row));
    });

    if (!load) {
      return reject(new Error('装载记录不存在'));
    }

    db.run(
      `INSERT INTO delivery_receipts (route_load_id, school_id, received_by, received_count, condition, signature, created_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      [loadId, schoolId, receivedBy, receivedCount, condition, signature],
      async function(err) {
        if (err) reject(err);
        
        const receiptId = this.lastID;
        
        await logProcessStep(
          load.meal_plan_id,
          '签收回执',
          'in_progress',
          `学校签收: ${receivedBy}，签收${receivedCount}份`,
          receivedBy,
          { loadId, schoolId, receivedCount, condition }
        );

        resolve({
          id: receiptId,
          loadId,
          schoolId,
          receivedBy,
          receivedCount,
          condition
        });
      }
    );
  });
}

function createExceptionReport(mealPlanId, stepName, exceptionType, description, relatedEntityType, relatedEntityId, reportedBy) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO exception_reports (meal_plan_id, step_name, exception_type, description, related_entity_type, related_entity_id, status, reported_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'open', ?, datetime('now'))`,
      [mealPlanId, stepName, exceptionType, description, relatedEntityType, relatedEntityId, reportedBy],
      function(err) {
        if (err) reject(err);
        else resolve({
          id: this.lastID,
          mealPlanId,
          stepName,
          exceptionType,
          description,
          status: 'open'
        });
      }
    );
  });
}

function resolveException(exceptionId, resolution, resolvedBy) {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE exception_reports SET status = 'resolved', resolved_by = ?, resolved_at = datetime('now'), resolution = ? WHERE id = ?`,
      [resolvedBy, resolution, exceptionId],
      err => err ? reject(err) : resolve({
        success: true,
        exceptionId,
        status: 'resolved',
        resolution
      })
    );
  });
}

function getExceptions(mealPlanId, status = null) {
  return new Promise((resolve, reject) => {
    let sql = `SELECT * FROM exception_reports WHERE meal_plan_id = ?`;
    const params = [mealPlanId];
    
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    
    sql += ' ORDER BY created_at DESC';
    
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
  });
}

async function completeDelivery(mealPlanId, operator) {
  const incompleteReceipts = await new Promise((resolve, reject) => {
    db.all(`
      SELECT rl.*, COUNT(dr.id) as receipt_count
      FROM route_loads rl
      LEFT JOIN delivery_receipts dr ON rl.id = dr.route_load_id
      WHERE rl.meal_plan_id = ? AND rl.status = 'completed'
      GROUP BY rl.id
      HAVING receipt_count = 0
    `, [mealPlanId], (err, rows) => err ? reject(err) : resolve(rows));
  });

  if (incompleteReceipts.length > 0) {
    return {
      success: false,
      message: `存在${incompleteReceipts.length}条线路未完成签收`,
      incompleteRoutes: incompleteReceipts
    };
  }

  await logProcessStep(
    mealPlanId,
    '配餐完成',
    'completed',
    '配餐流程全部完成',
    operator,
    { completedAt: new Date().toISOString() }
  );

  await new Promise((resolve, reject) => {
    db.run(`UPDATE meal_plans SET status = 'completed' WHERE id = ?`, [mealPlanId], err => err ? reject(err) : resolve());
  });

  return {
    success: true,
    message: '配餐流程全部完成',
    mealPlanId
  };
}

module.exports = {
  getRouteMealsForPlan,
  createRouteLoad,
  confirmRouteLoad,
  createDeliveryReceipt,
  createExceptionReport,
  resolveException,
  getExceptions,
  completeDelivery
};
