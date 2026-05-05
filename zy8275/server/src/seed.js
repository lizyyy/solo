import { prepare } from './database.js';
import { Role } from './stateMachine.js';
import { v4 as uuidv4 } from 'uuid';

const generateId = () => uuidv4();

export const seedData = () => {
  const roleCount = prepare('SELECT COUNT(*) as count FROM roles').get()?.count || 0;
  if (roleCount > 0) {
    console.log('Seed data already exists, skipping...');
    return;
  }

  const roles = [
    { id: Role.SHOP_MANAGER, name: '店长', description: '店铺管理人员，可以提交和查看施工申请' },
    { id: Role.ENGINEERING_SUPERVISOR, name: '工程主管', description: '负责审核施工图纸和时间安排' },
    { id: Role.SECURITY, name: '安保', description: '负责施工人员放行和现场管理' },
    { id: Role.ADMIN, name: '管理员', description: '系统管理员，拥有全部权限' },
  ];

  roles.forEach(role => {
    prepare('INSERT INTO roles (id, name, description) VALUES (?, ?, ?)').run(role.id, role.name, role.description);
  });

  const users = [
    { id: generateId(), username: 'store_manager_1', name: '张三', role_id: Role.SHOP_MANAGER },
    { id: generateId(), username: 'store_manager_2', name: '李四', role_id: Role.SHOP_MANAGER },
    { id: generateId(), username: 'eng_supervisor', name: '王工', role_id: Role.ENGINEERING_SUPERVISOR },
    { id: generateId(), username: 'security_1', name: '赵保安', role_id: Role.SECURITY },
    { id: generateId(), username: 'security_2', name: '钱保安', role_id: Role.SECURITY },
    { id: generateId(), username: 'admin', name: '孙管理员', role_id: Role.ADMIN },
  ];

  users.forEach(user => {
    prepare('INSERT INTO users (id, username, name, role_id) VALUES (?, ?, ?, ?)').run(user.id, user.username, user.name, user.role_id);
  });

  const shops = [
    { id: generateId(), name: '优衣库', floor: '1F', shop_number: '101', manager_name: '张三', manager_phone: '13800138001' },
    { id: generateId(), name: '星巴克', floor: '1F', shop_number: '102', manager_name: '李四', manager_phone: '13800138002' },
    { id: generateId(), name: 'H&M', floor: '2F', shop_number: '201', manager_name: '王五', manager_phone: '13800138003' },
    { id: generateId(), name: 'ZARA', floor: '2F', shop_number: '202', manager_name: '赵六', manager_phone: '13800138004' },
    { id: generateId(), name: '海底捞', floor: '3F', shop_number: '301', manager_name: '钱七', manager_phone: '13800138005' },
  ];

  shops.forEach(shop => {
    prepare('INSERT INTO shops (id, name, floor, shop_number, manager_name, manager_phone) VALUES (?, ?, ?, ?, ?, ?)').run(
      shop.id, shop.name, shop.floor, shop.shop_number, shop.manager_name, shop.manager_phone
    );
  });

  const workers = [
    { id: generateId(), name: '周师傅', id_card_number: '110101198001011234', phone: '13900139001', company: '诚信装修公司' },
    { id: generateId(), name: '吴师傅', id_card_number: '110101198502022345', phone: '13900139002', company: '诚信装修公司' },
    { id: generateId(), name: '郑师傅', id_card_number: '110101197803033456', phone: '13900139003', company: '顺发安装公司' },
    { id: generateId(), name: '王师傅', id_card_number: '110101198204044567', phone: '13900139004', company: '顺发安装公司' },
    { id: generateId(), name: '刘师傅', id_card_number: '110101198805055678', phone: '13900139005', company: '通达工程队' },
  ];

  workers.forEach(worker => {
    prepare('INSERT INTO construction_workers (id, name, id_card_number, phone, company) VALUES (?, ?, ?, ?, ?)').run(
      worker.id, worker.name, worker.id_card_number, worker.phone, worker.company
    );
  });

  const rules = [
    { 
      id: generateId(), 
      name: '夜间施工时间限制', 
      description: '夜间施工时间限制在22:00至次日06:00之间', 
      rule_type: 'TIME_WINDOW', 
      config: JSON.stringify({ startHour: 22, endHour: 6 }) 
    },
    { 
      id: generateId(), 
      name: '最大施工时长', 
      description: '单次申请最大施工时长不得超过8小时', 
      rule_type: 'MAX_DURATION', 
      config: JSON.stringify({ maxHours: 8 }) 
    },
    { 
      id: generateId(), 
      name: '提前申请时间', 
      description: '施工申请需提前24小时提交', 
      rule_type: 'ADVANCE_NOTICE', 
      config: JSON.stringify({ hours: 24 }) 
    },
  ];

  rules.forEach(rule => {
    prepare('INSERT INTO rules (id, name, description, rule_type, config) VALUES (?, ?, ?, ?, ?)').run(
      rule.id, rule.name, rule.description, rule.rule_type, rule.config
    );
  });

  const shopManagers = users.filter(u => u.role_id === Role.SHOP_MANAGER);
  const engSupervisor = users.find(u => u.role_id === Role.ENGINEERING_SUPERVISOR);
  const security = users.find(u => u.role_id === Role.SECURITY);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(22, 0, 0, 0);

  const tomorrowEnd = new Date(tomorrow);
  tomorrowEnd.setHours(tomorrowEnd.getHours() + 6);

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(22, 0, 0, 0);

  const yesterdayEnd = new Date(yesterday);
  yesterdayEnd.setHours(yesterdayEnd.getHours() + 6);

  const applications = [
    {
      id: generateId(),
      shop_id: shops[0].id,
      title: '店铺招牌更换',
      description: '更换店铺门口招牌，需要夜间施工',
      construction_type: '招牌安装',
      blueprint_url: 'https://example.com/blueprints/1.pdf',
      start_time: tomorrow.toISOString(),
      end_time: tomorrowEnd.toISOString(),
      status: 'SUBMITTED',
      created_by: shopManagers[0].id,
    },
    {
      id: generateId(),
      shop_id: shops[2].id,
      title: '试衣间改造',
      description: '改造试衣间，增加试衣镜和挂钩',
      construction_type: '室内改造',
      blueprint_url: 'https://example.com/blueprints/2.pdf',
      start_time: yesterday.toISOString(),
      end_time: yesterdayEnd.toISOString(),
      status: 'COMPLETED',
      created_by: shopManagers[1].id,
    },
  ];

  applications.forEach(app => {
    prepare(`INSERT INTO applications (id, shop_id, title, description, construction_type, blueprint_url, start_time, end_time, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      app.id, app.shop_id, app.title, app.description, 
      app.construction_type, app.blueprint_url, app.start_time, 
      app.end_time, app.status, app.created_by
    );
  });

  const approvalActions = [
    {
      id: generateId(),
      application_id: applications[1].id,
      action_type: 'SUBMIT',
      from_status: 'DRAFT',
      to_status: 'SUBMITTED',
      actor_id: shopManagers[1].id,
      actor_role: Role.SHOP_MANAGER,
      comment: '提交施工申请',
      created_at: yesterday.toISOString(),
    },
    {
      id: generateId(),
      application_id: applications[1].id,
      action_type: 'ENGINEERING_APPROVE',
      from_status: 'SUBMITTED',
      to_status: 'ENGINEERING_APPROVED',
      actor_id: engSupervisor.id,
      actor_role: Role.ENGINEERING_SUPERVISOR,
      comment: '图纸审核通过，时间安排合理',
      created_at: new Date(yesterday.getTime() - 3600000).toISOString(),
    },
    {
      id: generateId(),
      application_id: applications[1].id,
      action_type: 'SECURITY_APPROVE',
      from_status: 'ENGINEERING_APPROVED',
      to_status: 'SECURITY_APPROVED',
      actor_id: security.id,
      actor_role: Role.SECURITY,
      comment: '同意放行，请按时进场',
      created_at: new Date(yesterday.getTime() - 1800000).toISOString(),
    },
    {
      id: generateId(),
      application_id: applications[1].id,
      action_type: 'CHECK_IN',
      from_status: 'SECURITY_APPROVED',
      to_status: 'IN_PROGRESS',
      actor_id: security.id,
      actor_role: Role.SECURITY,
      comment: '施工人员已进场',
      created_at: yesterday.toISOString(),
    },
    {
      id: generateId(),
      application_id: applications[1].id,
      action_type: 'COMPLETE',
      from_status: 'IN_PROGRESS',
      to_status: 'COMPLETED',
      actor_id: security.id,
      actor_role: Role.SECURITY,
      comment: '施工已完成，现场清理完毕',
      created_at: yesterdayEnd.toISOString(),
    },
  ];

  approvalActions.forEach(action => {
    prepare(`INSERT INTO approval_actions (id, application_id, action_type, from_status, to_status, actor_id, actor_role, comment, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      action.id, action.application_id, action.action_type, 
      action.from_status, action.to_status, action.actor_id, 
      action.actor_role, action.comment, action.created_at
    );
  });

  console.log('Seed data inserted successfully');
};
