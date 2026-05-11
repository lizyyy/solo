const cron = require('node-cron');
const { query, queryOne, runInsert, exec, getNow, toBoolean } = require('../database');

function checkOverdueRecycling() {
  const today = new Date().toISOString();

  const overdueApplications = query(
    `SELECT a.*
     FROM part_applications a
     WHERE a.requires_recycling = 1
       AND a.status = 'delivered'
       AND a.recycling_deadline < ?`,
    [today]
  );

  const results = [];

  for (const app of overdueApplications) {
    const existingTodo = queryOne(
      `SELECT * FROM overdue_todos 
       WHERE application_id = ? AND todo_type = 'recycling' AND is_handled = 0`,
      [app.id]
    );

    if (!existingTodo) {
      runInsert(
        'INSERT INTO overdue_todos (application_id, todo_type, todo_description, due_date, created_at) VALUES (?, ?, ?, ?, ?)',
        [app.id, 'recycling', `回收旧件: ${app.part_name} (已逾期)`, app.recycling_deadline, getNow()]
      );

      results.push({
        application_no: app.application_no,
        part_name: app.part_name,
        recycling_deadline: app.recycling_deadline,
        action: 'added_to_todos'
      });
    }
  }

  return {
    checked: overdueApplications.length,
    added: results.length,
    details: results
  };
}

function checkStuckApplications() {
  const results = [];

  const stuckInReview = query(
    `SELECT a.* FROM part_applications a
     WHERE a.status = 'pending_review'
       AND a.created_at < datetime('now', '-3 days')`
  );

  for (const app of stuckInReview) {
    const existingTodo = queryOne(
      `SELECT * FROM overdue_todos 
       WHERE application_id = ? AND todo_type = 'stuck_review' AND is_handled = 0`,
      [app.id]
    );

    if (!existingTodo) {
      runInsert(
        'INSERT INTO overdue_todos (application_id, todo_type, todo_description, due_date, created_at) VALUES (?, ?, ?, ?, ?)',
        [app.id, 'stuck_review', `申请待审核超过3天: ${app.part_name}`, getNow(), getNow()]
      );

      results.push({
        application_no: app.application_no,
        type: 'stuck_review',
        part_name: app.part_name
      });
    }
  }

  const stuckInInventory = query(
    `SELECT a.* FROM part_applications a
     WHERE a.status = 'inventory_locked'
       AND a.created_at < datetime('now', '-2 days')`
  );

  for (const app of stuckInInventory) {
    const existingTodo = queryOne(
      `SELECT * FROM overdue_todos 
       WHERE application_id = ? AND todo_type = 'stuck_shipment' AND is_handled = 0`,
      [app.id]
    );

    if (!existingTodo) {
      runInsert(
        'INSERT INTO overdue_todos (application_id, todo_type, todo_description, due_date, created_at) VALUES (?, ?, ?, ?, ?)',
        [app.id, 'stuck_shipment', `库存锁定后未发货超过2天: ${app.part_name}`, getNow(), getNow()]
      );

      results.push({
        application_no: app.application_no,
        type: 'stuck_shipment',
        part_name: app.part_name
      });
    }
  }

  return {
    total: results.length,
    details: results
  };
}

function markTodoHandled(todoId, operator = 'system') {
  const result = exec(
    'UPDATE overdue_todos SET is_handled = 1, handled_at = ? WHERE id = ? AND is_handled = 0',
    [getNow(), todoId]
  );

  return {
    success: result.changes > 0,
    updated: result.changes
  };
}

function initScheduler() {
  cron.schedule('0 * * * *', () => {
    console.log(`[${new Date().toISOString()}] 运行定时任务: 检查旧件回收逾期`);
    const result = checkOverdueRecycling();
    console.log(`  检查完成: ${result.checked} 个逾期申请, 新增 ${result.added} 个待办`);
  });

  cron.schedule('0 9,15 * * *', () => {
    console.log(`[${new Date().toISOString()}] 运行定时任务: 检查卡住的申请`);
    const result = checkStuckApplications();
    console.log(`  检查完成: 新增 ${result.total} 个待办`);
  });

  console.log('定时任务已启动');
}

module.exports = {
  checkOverdueRecycling,
  checkStuckApplications,
  markTodoHandled,
  initScheduler
};
