import { Router } from 'express';
import { prepare } from './database.js';
import { v4 as uuidv4 } from 'uuid';
import { Parser } from 'json2csv';
import { 
  validateTransition, 
  getAvailableActions, 
  actionToStateMap,
  ApplicationStatus,
  ActionType,
  Role,
  statusDisplayNames,
  actionDisplayNames,
  roleDisplayNames
} from './stateMachine.js';

const router = Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

router.get('/users', (req, res) => {
  const users = prepare(`
    SELECT u.*, r.name as role_name, r.id as role_id
    FROM users u
    JOIN roles r ON u.role_id = r.id
  `).all();
  res.json(users);
});

router.get('/users/:id', (req, res) => {
  const user = prepare(`
    SELECT u.*, r.name as role_name, r.id as role_id
    FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.id = ?
  `).get(req.params.id);
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json(user);
});

router.get('/roles', (req, res) => {
  const roles = prepare('SELECT * FROM roles').all();
  res.json(roles);
});

router.get('/shops', (req, res) => {
  const shops = prepare('SELECT * FROM shops ORDER BY floor, shop_number').all();
  res.json(shops);
});

router.get('/shops/:id', (req, res) => {
  const shop = prepare('SELECT * FROM shops WHERE id = ?').get(req.params.id);
  if (!shop) {
    return res.status(404).json({ error: 'Shop not found' });
  }
  res.json(shop);
});

router.get('/workers', (req, res) => {
  const workers = prepare('SELECT * FROM construction_workers').all();
  res.json(workers);
});

router.get('/rules', (req, res) => {
  const rules = prepare('SELECT * FROM rules').all();
  const parsedRules = rules.map(rule => ({
    ...rule,
    config: JSON.parse(rule.config)
  }));
  res.json(parsedRules);
});

router.get('/applications', (req, res) => {
  const { status, shop_id, created_by } = req.query;
  
  let query = `
    SELECT a.*, s.name as shop_name, s.floor, s.shop_number,
           u.name as creator_name, u.username as creator_username
    FROM applications a
    JOIN shops s ON a.shop_id = s.id
    JOIN users u ON a.created_by = u.id
    WHERE 1=1
  `;
  const params = [];
  
  if (status) {
    query += ' AND a.status = ?';
    params.push(status);
  }
  if (shop_id) {
    query += ' AND a.shop_id = ?';
    params.push(shop_id);
  }
  if (created_by) {
    query += ' AND a.created_by = ?';
    params.push(created_by);
  }
  
  query += ' ORDER BY a.created_at DESC';
  
  const applications = prepare(query).all(...params);
  
  const applicationsWithMeta = applications.map(app => ({
    ...app,
    status_display: statusDisplayNames[app.status] || app.status,
    available_actions: []
  }));
  
  res.json(applicationsWithMeta);
});

router.get('/applications/:id', (req, res) => {
  const application = prepare(`
    SELECT a.*, s.name as shop_name, s.floor, s.shop_number, s.manager_name, s.manager_phone,
           u.name as creator_name, u.username as creator_username, u.role_id as creator_role
    FROM applications a
    JOIN shops s ON a.shop_id = s.id
    JOIN users u ON a.created_by = u.id
    WHERE a.id = ?
  `).get(req.params.id);
  
  if (!application) {
    return res.status(404).json({ error: 'Application not found' });
  }
  
  const actions = prepare(`
    SELECT aa.*, u.name as actor_name
    FROM approval_actions aa
    JOIN users u ON aa.actor_id = u.id
    WHERE aa.application_id = ?
    ORDER BY aa.created_at ASC
  `).all(req.params.id);
  
  const actionsWithDisplay = actions.map(action => ({
    ...action,
    action_type_display: actionDisplayNames[action.action_type] || action.action_type,
    actor_role_display: roleDisplayNames[action.actor_role] || action.actor_role,
    metadata: action.metadata ? JSON.parse(action.metadata) : null
  }));
  
  const result = {
    ...application,
    status_display: statusDisplayNames[application.status] || application.status,
    history: actionsWithDisplay
  };
  
  res.json(result);
});

router.get('/applications/:id/available-actions', (req, res) => {
  const { user_role } = req.query;
  
  if (!user_role) {
    return res.status(400).json({ error: 'user_role is required' });
  }
  
  const application = prepare('SELECT * FROM applications WHERE id = ?').get(req.params.id);
  
  if (!application) {
    return res.status(404).json({ error: 'Application not found' });
  }
  
  const availableActions = getAvailableActions(application.status, user_role);
  
  const actionsWithDisplay = availableActions.map(action => ({
    action,
    display_name: actionDisplayNames[action] || action
  }));
  
  res.json({
    current_status: application.status,
    current_status_display: statusDisplayNames[application.status] || application.status,
    available_actions: actionsWithDisplay
  });
});

router.post('/applications', (req, res) => {
  const { 
    shop_id, title, description, construction_type, 
    blueprint_url, start_time, end_time, created_by 
  } = req.body;
  
  if (!shop_id || !title || !construction_type || !start_time || !end_time || !created_by) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  const id = uuidv4();
  
  prepare(`
    INSERT INTO applications (id, shop_id, title, description, construction_type, blueprint_url, start_time, end_time, status, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, shop_id, title, description, construction_type, 
    blueprint_url || null, start_time, end_time, ApplicationStatus.DRAFT, created_by
  );
  
  const auditLog = {
    id: uuidv4(),
    action: 'CREATE_APPLICATION',
    actor_id: created_by,
    actor_role: Role.SHOP_MANAGER,
    target_type: 'APPLICATION',
    target_id: id,
    details: JSON.stringify({ title, shop_id }),
    ip_address: req.ip
  };
  
  prepare(`
    INSERT INTO audit_logs (id, action, actor_id, actor_role, target_type, target_id, details, ip_address)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    auditLog.id, auditLog.action, auditLog.actor_id, auditLog.actor_role,
    auditLog.target_type, auditLog.target_id, auditLog.details, auditLog.ip_address
  );
  
  res.status(201).json({ id, status: ApplicationStatus.DRAFT });
});

router.post('/applications/:id/actions', (req, res) => {
  const { action_type, actor_id, actor_role, comment, metadata } = req.body;
  
  if (!action_type || !actor_id || !actor_role) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  const application = prepare('SELECT * FROM applications WHERE id = ?').get(req.params.id);
  
  if (!application) {
    return res.status(404).json({ error: 'Application not found' });
  }
  
  const validation = validateTransition(
    application.status, 
    action_type, 
    actor_role,
    application
  );
  
  if (!validation.valid) {
    return res.status(400).json({ error: validation.reason });
  }
  
  const newStatus = actionToStateMap[action_type];
  
  const actionId = uuidv4();
  
  prepare(`
    INSERT INTO approval_actions (id, application_id, action_type, from_status, to_status, actor_id, actor_role, comment, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    actionId, req.params.id, action_type, application.status, newStatus,
    actor_id, actor_role, comment || null, metadata ? JSON.stringify(metadata) : null
  );
  
  prepare(`
    UPDATE applications 
    SET status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(newStatus, req.params.id);
  
  const auditLogId = uuidv4();
  prepare(`
    INSERT INTO audit_logs (id, action, actor_id, actor_role, target_type, target_id, details, ip_address)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    auditLogId, action_type, actor_id, actor_role,
    'APPLICATION', req.params.id,
    JSON.stringify({ 
      from_status: application.status, 
      to_status: newStatus,
      comment 
    }),
    req.ip
  );
  
  res.json({
    success: true,
    new_status: newStatus,
    new_status_display: statusDisplayNames[newStatus] || newStatus
  });
});

router.get('/audit-logs', (req, res) => {
  const { limit = 100, offset = 0 } = req.query;
  
  const logs = prepare(`
    SELECT al.*, u.name as actor_name
    FROM audit_logs al
    LEFT JOIN users u ON al.actor_id = u.id
    ORDER BY al.created_at DESC
    LIMIT ? OFFSET ?
  `).all(parseInt(limit), parseInt(offset));
  
  const logsWithDetails = logs.map(log => ({
    ...log,
    details: log.details ? JSON.parse(log.details) : null
  }));
  
  res.json(logsWithDetails);
});

router.get('/export/csv', (req, res) => {
  const { start_date, end_date } = req.query;
  
  let query = `
    SELECT 
      a.id as application_id,
      a.title,
      s.name as shop_name,
      s.floor,
      s.shop_number,
      a.status,
      a.construction_type,
      a.start_time,
      a.end_time,
      u.name as creator_name,
      aa.action_type,
      aa.from_status,
      aa.to_status,
      aa.comment,
      aa.created_at as action_time,
      au.name as actor_name,
      r.name as actor_role_name
    FROM applications a
    JOIN shops s ON a.shop_id = s.id
    JOIN users u ON a.created_by = u.id
    LEFT JOIN approval_actions aa ON a.id = aa.application_id
    LEFT JOIN users au ON aa.actor_id = au.id
    LEFT JOIN roles r ON aa.actor_role = r.id
    WHERE 1=1
  `;
  
  const params = [];
  
  if (start_date) {
    query += ' AND a.created_at >= ?';
    params.push(start_date);
  }
  if (end_date) {
    query += ' AND a.created_at <= ?';
    params.push(end_date);
  }
  
  query += ' ORDER BY a.created_at DESC, aa.created_at ASC';
  
  const data = prepare(query).all(...params);
  
  const transformedData = data.map(row => ({
    '申请ID': row.application_id,
    '申请标题': row.title,
    '店铺名称': row.shop_name,
    '楼层': row.floor,
    '铺位号': row.shop_number,
    '当前状态': statusDisplayNames[row.status] || row.status,
    '施工类型': row.construction_type,
    '计划开始时间': row.start_time,
    '计划结束时间': row.end_time,
    '申请人': row.creator_name,
    '操作类型': row.action_type ? (actionDisplayNames[row.action_type] || row.action_type) : '',
    '操作前状态': row.from_status ? (statusDisplayNames[row.from_status] || row.from_status) : '',
    '操作后状态': row.to_status ? (statusDisplayNames[row.to_status] || row.to_status) : '',
    '操作备注': row.comment || '',
    '操作时间': row.action_time || '',
    '操作人': row.actor_name || '',
    '操作人角色': row.actor_role_name || ''
  }));
  
  try {
    const parser = new Parser();
    const csv = parser.parse(transformedData);
    
    res.header('Content-Type', 'text/csv; charset=utf-8');
    res.header('Content-Disposition', `attachment; filename=approval_flow_${new Date().toISOString().split('T')[0]}.csv`);
    res.send('\uFEFF' + csv);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate CSV' });
  }
});

router.get('/export/markdown', (req, res) => {
  const { start_date, end_date } = req.query;
  
  let query = `
    SELECT 
      a.*,
      s.name as shop_name,
      s.floor,
      s.shop_number,
      u.name as creator_name
    FROM applications a
    JOIN shops s ON a.shop_id = s.id
    JOIN users u ON a.created_by = u.id
    WHERE 1=1
  `;
  
  const params = [];
  
  if (start_date) {
    query += ' AND a.created_at >= ?';
    params.push(start_date);
  }
  if (end_date) {
    query += ' AND a.created_at <= ?';
    params.push(end_date);
  }
  
  query += ' ORDER BY a.created_at DESC';
  
  const applications = prepare(query).all(...params);
  
  let markdown = `# 夜间施工申请审批流水

导出时间: ${new Date().toLocaleString('zh-CN')}

---

`;
  
  for (const app of applications) {
    const actions = prepare(`
      SELECT aa.*, u.name as actor_name
      FROM approval_actions aa
      JOIN users u ON aa.actor_id = u.id
      WHERE aa.application_id = ?
      ORDER BY aa.created_at ASC
    `).all(app.id);
    
    markdown += `## ${app.title}

| 字段 | 值 |
|------|-----|
| 申请ID | ${app.id} |
| 店铺 | ${app.shop_name} (${app.floor} ${app.shop_number}) |
| 施工类型 | ${app.construction_type} |
| 计划时间 | ${app.start_time} 至 ${app.end_time} |
| 当前状态 | ${statusDisplayNames[app.status] || app.status} |
| 申请人 | ${app.creator_name} |

### 审批流程

| 序号 | 操作 | 操作人 | 角色 | 从状态 | 到状态 | 时间 | 备注 |
|------|------|--------|------|--------|--------|------|------|
`;
    
    actions.forEach((action, index) => {
      const fromStatus = action.from_status ? (statusDisplayNames[action.from_status] || action.from_status) : '-';
      const toStatus = statusDisplayNames[action.to_status] || action.to_status;
      const actionName = actionDisplayNames[action.action_type] || action.action_type;
      const roleName = roleDisplayNames[action.actor_role] || action.actor_role;
      
      markdown += `| ${index + 1} | ${actionName} | ${action.actor_name} | ${roleName} | ${fromStatus} | ${toStatus} | ${action.created_at} | ${action.comment || '-'} |\n`;
    });
    
    markdown += `\n---\n\n`;
  }
  
  res.header('Content-Type', 'text/markdown; charset=utf-8');
  res.header('Content-Disposition', `attachment; filename=approval_flow_${new Date().toISOString().split('T')[0]}.md`);
  res.send(markdown);
});

router.get('/dashboard/stats', (req, res) => {
  const statusCounts = prepare(`
    SELECT status, COUNT(*) as count
    FROM applications
    GROUP BY status
  `).all();
  
  const recentActivities = prepare(`
    SELECT aa.*, a.title, u.name as actor_name
    FROM approval_actions aa
    JOIN applications a ON aa.application_id = a.id
    JOIN users u ON aa.actor_id = u.id
    ORDER BY aa.created_at DESC
    LIMIT 10
  `).all();
  
  const stats = {
    by_status: {},
    recent_activities: recentActivities.map(act => ({
      ...act,
      action_type_display: actionDisplayNames[act.action_type] || act.action_type
    }))
  };
  
  Object.keys(statusDisplayNames).forEach(status => {
    const count = statusCounts.find(sc => sc.status === status)?.count || 0;
    stats.by_status[status] = {
      count,
      display_name: statusDisplayNames[status]
    };
  });
  
  res.json(stats);
});

export default router;
