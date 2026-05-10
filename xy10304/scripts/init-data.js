const { openDatabase, initDatabase } = require('../database');

async function main() {
  console.log('开始初始化样例数据...');
  
  const db = await initDatabase();
  
  await db.transaction(async () => {
    await db.exec('DELETE FROM task_history');
    await db.exec('DELETE FROM compensations');
    await db.exec('DELETE FROM feedbacks');
    await db.exec('DELETE FROM inspections');
    await db.exec('DELETE FROM tasks');
    await db.exec('DELETE FROM cleaners');
    await db.exec('DELETE FROM properties');
    
    const properties = [
      { name: '阳光海景公寓A栋', address: '厦门市思明区环岛路123号', rooms: 3, area: 120 },
      { name: '城市中心精品房', address: '上海市黄浦区南京东路456号', rooms: 2, area: 80 },
      { name: '山水田园民宿', address: '杭州市西湖区龙井路789号', rooms: 5, area: 200 },
      { name: '温馨小窝1号', address: '北京市朝阳区望京街100号', rooms: 1, area: 45 },
      { name: '商务豪华套房', address: '深圳市南山区科技园200号', rooms: 2, area: 90 }
    ];
    
    const propertyStmt = db.prepare('INSERT INTO properties (name, address, rooms, area) VALUES (?, ?, ?, ?)');
    const propertyIds = [];
    for (const p of properties) {
      const result = await propertyStmt.run(p.name, p.address, p.rooms, p.area);
      propertyIds.push(result.lastInsertRowid);
    }
    
    const cleaners = [
      { name: '张阿姨', phone: '13800138001' },
      { name: '李大姐', phone: '13800138002' },
      { name: '王嫂', phone: '13800138003' },
      { name: '陈姐', phone: '13800138004' }
    ];
    
    const cleanerStmt = db.prepare('INSERT INTO cleaners (name, phone) VALUES (?, ?)');
    const cleanerIds = [];
    for (const c of cleaners) {
      const result = await cleanerStmt.run(c.name, c.phone);
      cleanerIds.push(result.lastInsertRowid);
    }
    
    const addHistory = async (taskId, action, oldStatus, newStatus, changedBy, details) => {
      await db.prepare(`
        INSERT INTO task_history (task_id, action, old_status, new_status, changed_by, details)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(taskId, action, oldStatus, newStatus, changedBy, details);
    };
    
    const now = new Date();
    const formatDate = (daysOffset = 0) => {
      const d = new Date(now);
      d.setDate(d.getDate() + daysOffset);
      return d.toISOString().slice(0, 10);
    };
    
    const formatDateTime = (daysOffset = 0, hoursOffset = 0) => {
      const d = new Date(now);
      d.setDate(d.getDate() + daysOffset);
      d.setHours(d.getHours() + hoursOffset);
      return d.toISOString().slice(0, 19).replace('T', ' ');
    };
    
    console.log('创建路径1：正常完成 - 阳光海景公寓A栋');
    {
      const taskStmt = db.prepare(`
        INSERT INTO tasks (property_id, cleaner_id, booking_id, guest_name, checkin_date, checkout_date, priority, 
                           status, assigned_at, started_at, completed_at, inspected_at, closed_at, is_settled)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const result = await taskStmt.run(
        propertyIds[0], cleanerIds[0], 'BK20260508001', '王先生', 
        formatDate(-3), formatDate(-1), 'normal',
        'closed', 
        formatDateTime(-3, 8), formatDateTime(-3, 10), formatDateTime(-3, 14), 
        formatDateTime(-3, 15), formatDateTime(-2, 9), 1
      );
      const taskId = result.lastInsertRowid;
      
      await addHistory(taskId, '创建任务', null, 'assigned', '系统', '创建保洁任务');
      await addHistory(taskId, '开始保洁', 'assigned', 'in_progress', '张阿姨', '保洁员开始工作');
      await addHistory(taskId, '完成保洁', 'in_progress', 'completed', '张阿姨', '保洁完成，等待检查');
      
      await db.prepare(`
        INSERT INTO inspections (task_id, inspector, result, issues, penalty_points, penalty_amount, needs_redo, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(taskId, '管理员', 'pass', null, 0, 0, 0, '检查合格，客房整洁，卫生达标');
      
      await addHistory(taskId, '检查通过', 'completed', 'inspected', '管理员', '检查结果: pass，扣分: 0，处罚: ¥0');
      await addHistory(taskId, '关闭并结算', 'inspected', 'closed', '系统', '任务已关闭并完成结算');
    }
    
    console.log('创建路径2：发现问题返工 - 城市中心精品房');
    {
      const taskStmt = db.prepare(`
        INSERT INTO tasks (property_id, cleaner_id, booking_id, guest_name, checkin_date, checkout_date, priority, 
                           status, assigned_at, started_at, completed_at, inspected_at, redo_count, total_penalty)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const result = await taskStmt.run(
        propertyIds[1], cleanerIds[1], 'BK20260509002', '李女士', 
        formatDate(-2), formatDate(0), 'high',
        'redo_completed', 
        formatDateTime(-2, 9), formatDateTime(-2, 11), formatDateTime(-2, 15), 
        formatDateTime(-1, 16), 1, 50
      );
      const taskId = result.lastInsertRowid;
      
      await addHistory(taskId, '创建任务', null, 'assigned', '系统', '创建保洁任务');
      await addHistory(taskId, '开始保洁', 'assigned', 'in_progress', '李大姐', '保洁员开始工作');
      await addHistory(taskId, '完成保洁', 'in_progress', 'completed', '李大姐', '保洁完成，等待检查');
      
      await db.prepare(`
        INSERT INTO inspections (task_id, inspector, result, issues, penalty_points, penalty_amount, needs_redo, notes, inspection_time)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(taskId, '管理员', 'fail', '卫生间地板有污渍，床铺整理不整齐', 10, 50, 1, '需要重新清洁', formatDateTime(-2, 16));
      
      await addHistory(taskId, '检查不通过', 'completed', 'redo_needed', '管理员', '发现问题: 卫生间地板有污渍，床铺整理不整齐，扣分: 10，处罚: ¥50');
      
      await db.prepare(`
        INSERT INTO inspections (task_id, inspector, result, issues, penalty_points, penalty_amount, needs_redo, notes, inspection_time)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(taskId, '管理员', 'pass', '返工后检查合格', 0, 0, 0, '问题已解决', formatDateTime(-1, 16));
      
      await addHistory(taskId, '开始返工', 'redo_needed', 'redo_in_progress', '李大姐', '保洁员开始返工');
      await addHistory(taskId, '完成保洁', 'redo_in_progress', 'redo_completed', '李大姐', '保洁完成，等待检查');
      await addHistory(taskId, '检查通过', 'redo_completed', 'inspected', '管理员', '检查结果: pass，扣分: 0，处罚: ¥0');
    }
    
    console.log('创建路径3：赔付后关闭 - 山水田园民宿');
    {
      const taskStmt = db.prepare(`
        INSERT INTO tasks (property_id, cleaner_id, booking_id, guest_name, checkin_date, checkout_date, priority, 
                           status, assigned_at, started_at, completed_at, inspected_at, closed_at, is_settled, 
                           redo_count, total_penalty, total_compensation)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const result = await taskStmt.run(
        propertyIds[2], cleanerIds[2], 'BK20260507003', '赵先生', 
        formatDate(-5), formatDate(-3), 'normal',
        'closed', 
        formatDateTime(-5, 8), formatDateTime(-5, 10), formatDateTime(-5, 15), 
        formatDateTime(-5, 16), formatDateTime(-3, 10), 1,
        0, 30, 200
      );
      const taskId = result.lastInsertRowid;
      
      await addHistory(taskId, '创建任务', null, 'assigned', '系统', '创建保洁任务');
      await addHistory(taskId, '开始保洁', 'assigned', 'in_progress', '王嫂', '保洁员开始工作');
      await addHistory(taskId, '完成保洁', 'in_progress', 'completed', '王嫂', '保洁完成，等待检查');
      
      await db.prepare(`
        INSERT INTO inspections (task_id, inspector, result, issues, penalty_points, penalty_amount, needs_redo, notes, inspection_time)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(taskId, '管理员', 'pass_with_issues', '厨房灶台有轻微油渍，已提醒保洁员注意', 5, 30, 0, '整体合格，小问题已记录', formatDateTime(-5, 16));
      
      await addHistory(taskId, '检查通过', 'completed', 'inspected', '管理员', '检查结果: pass_with_issues，扣分: 5，处罚: ¥30');
      
      const feedbackResult = await db.prepare(`
        INSERT INTO feedbacks (task_id, guest_name, rating, issues, severity, needs_redo, compensation_request, notes, feedback_time)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(taskId, '赵先生', 2, '床上发现头发，浴室有异味', 'high', 0, 1, '入住体验不好，要求赔偿', formatDateTime(-4, 12));
      
      await addHistory(taskId, '住客反馈', 'inspected', 'inspected', '系统', '住客评分: 2分，问题: 床上发现头发，浴室有异味');
      
      await db.prepare(`
        INSERT INTO compensations (task_id, feedback_id, reason, amount, status, settled_from_cleaner, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(taskId, feedbackResult.lastInsertRowid, '住客反馈卫生问题，要求赔偿', 200, 'approved', 1, '从保洁员工资中扣除');
      
      await addHistory(taskId, '赔付处理', 'inspected', 'inspected', '管理员', '赔付原因: 住客反馈卫生问题，要求赔偿，金额: ¥200');
      await addHistory(taskId, '关闭并结算', 'inspected', 'closed', '系统', '任务已关闭并完成结算');
    }
    
    console.log('创建额外样例任务...');
    
    {
      const taskStmt = db.prepare(`
        INSERT INTO tasks (property_id, cleaner_id, booking_id, guest_name, checkin_date, checkout_date, priority, 
                           status, assigned_at, started_at, completed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const result = await taskStmt.run(
        propertyIds[3], cleanerIds[3], 'BK20260510004', '孙女士', 
        formatDate(0), formatDate(2), 'normal',
        'completed', 
        formatDateTime(0, 8), formatDateTime(0, 10), formatDateTime(0, 13)
      );
      const taskId = result.lastInsertRowid;
      
      await addHistory(taskId, '创建任务', null, 'assigned', '系统', '创建保洁任务');
      await addHistory(taskId, '开始保洁', 'assigned', 'in_progress', '陈姐', '保洁员开始工作');
      await addHistory(taskId, '完成保洁', 'in_progress', 'completed', '陈姐', '保洁完成，等待检查');
    }
    
    {
      const taskStmt = db.prepare(`
        INSERT INTO tasks (property_id, cleaner_id, booking_id, guest_name, checkin_date, checkout_date, priority, 
                           status, assigned_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const result = await taskStmt.run(
        propertyIds[4], cleanerIds[0], 'BK20260511005', '周先生', 
        formatDate(1), formatDate(3), 'high',
        'assigned', 
        formatDateTime(1, 8)
      );
      const taskId = result.lastInsertRowid;
      
      await addHistory(taskId, '创建任务', null, 'assigned', '系统', '创建保洁任务');
    }
    
    await db.prepare(`
      UPDATE cleaners 
      SET total_tasks = 1, redo_tasks = 0, rating = 5.0
      WHERE id = ?
    `).run(cleanerIds[0]);
    
    await db.prepare(`
      UPDATE cleaners 
      SET total_tasks = 1, redo_tasks = 1, rating = 4.8
      WHERE id = ?
    `).run(cleanerIds[1]);
    
    await db.prepare(`
      UPDATE cleaners 
      SET total_tasks = 1, redo_tasks = 0, rating = 3.8
      WHERE id = ?
    `).run(cleanerIds[2]);
    
    await db.prepare(`
      UPDATE cleaners 
      SET total_tasks = 1, redo_tasks = 0, rating = 5.0
      WHERE id = ?
    `).run(cleanerIds[3]);
  });
  
  console.log('✓ 样例数据初始化完成！');
  console.log('');
  console.log('初始化的房源：');
  const props = await db.prepare('SELECT id, name FROM properties').all();
  props.forEach(p => console.log(`  - ${p.id}: ${p.name}`));
  console.log('');
  console.log('初始化的保洁员：');
  const clrs = await db.prepare('SELECT id, name, rating FROM cleaners').all();
  clrs.forEach(c => console.log(`  - ${c.id}: ${c.name} (评分: ${c.rating})`));
  console.log('');
  console.log('样例任务覆盖：');
  console.log('  1. 阳光海景公寓A栋 - 正常完成（已关闭）');
  console.log('  2. 城市中心精品房 - 发现问题返工（返工完成待检查）');
  console.log('  3. 山水田园民宿 - 住客反馈，赔付后关闭（已关闭）');
  console.log('  4. 温馨小窝1号 - 完成待检查');
  console.log('  5. 商务豪华套房 - 已指派待开始');
  console.log('');
  console.log('运行 npm start 启动应用');
}

main().catch(err => {
  console.error('初始化失败:', err);
  process.exit(1);
});
