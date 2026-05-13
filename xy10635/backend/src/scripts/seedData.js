const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const dbPath = path.join(__dirname, '../../data/conflict_assignment.db');
const db = new sqlite3.Database(dbPath);

const lawyers = [
  { name: '张伟', specialty: 'civil', capacity: 5 },
  { name: '李芳', specialty: 'commercial', capacity: 4 },
  { name: '王强', specialty: 'criminal', capacity: 6 },
  { name: '刘敏', specialty: 'labor', capacity: 5 },
  { name: '陈明', specialty: 'intellectual_property', capacity: 3 },
  { name: '杨丽', specialty: 'family', capacity: 4 },
  { name: '赵刚', specialty: 'administrative', capacity: 3 },
  { name: '周婷', specialty: 'bankruptcy', capacity: 4 }
];

const cases = [
  { case_number: 'CASE-2024-001', title: '合同纠纷案', opposing_party: '北京科技有限公司', case_domain: 'commercial', priority: 'high', status: 'completed', created_by: '管理员' },
  { case_number: 'CASE-2024-002', title: '劳动争议案', opposing_party: '上海贸易公司', case_domain: 'labor', priority: 'medium', status: 'in_progress', created_by: '管理员' },
  { case_number: 'CASE-2024-003', title: '知识产权侵权案', opposing_party: '深圳电子公司', case_domain: 'intellectual_property', priority: 'high', status: 'review', created_by: '管理员' },
  { case_number: 'CASE-2024-004', title: '离婚财产分割案', opposing_party: '个人', case_domain: 'family', priority: 'medium', status: 'pending', created_by: '张律师' },
  { case_number: 'CASE-2024-005', title: '行政诉讼案', opposing_party: '某政府部门', case_domain: 'administrative', priority: 'low', status: 'assigned', created_by: '管理员' },
  { case_number: 'CASE-2024-006', title: '破产清算案', opposing_party: '广州制造业公司', case_domain: 'bankruptcy', priority: 'high', status: 'in_progress', created_by: '李律师' },
  { case_number: 'CASE-2024-007', title: '民间借贷纠纷案', opposing_party: '北京科技有限公司', case_domain: 'civil', priority: 'medium', status: 'pending', created_by: '管理员' },
  { case_number: 'CASE-2024-008', title: '刑事辩护案', opposing_party: '个人', case_domain: 'criminal', priority: 'high', status: 'assigned', created_by: '王律师' },
  { case_number: 'CASE-2024-009', title: '房屋买卖合同纠纷', opposing_party: '北京房地产公司', case_domain: 'civil', priority: 'medium', status: 'completed', created_by: '管理员' },
  { case_number: 'CASE-2024-010', title: '商标侵权案', opposing_party: '深圳电子公司', case_domain: 'intellectual_property', priority: 'high', status: 'in_progress', created_by: '张律师' },
  { case_number: 'CASE-2024-011', title: '工伤赔偿案', opposing_party: '上海贸易公司', case_domain: 'labor', priority: 'medium', status: 'pending', created_by: '管理员' },
  { case_number: 'CASE-2024-012', title: '股权转让纠纷案', opposing_party: '广州投资公司', case_domain: 'commercial', priority: 'high', status: 'review', created_by: '李律师' }
];

const seedDatabase = () => {
  return new Promise((resolve, reject) => {
    db.serialize(async () => {
      try {
        const now = new Date().toISOString();
        
        console.log('开始插入律师数据...');
        const lawyerIds = [];
        for (const lawyer of lawyers) {
          const id = uuidv4();
          lawyerIds.push(id);
          await new Promise((res, rej) => {
            db.run(
              `INSERT INTO lawyers (id, name, specialty, capacity, current_load, status, created_at, updated_at)
               VALUES (?, ?, ?, ?, 0, 'active', ?, ?)`,
              [id, lawyer.name, lawyer.specialty, lawyer.capacity, now, now],
              (err) => err ? rej(err) : res()
            );
          });
        }
        console.log('律师数据插入完成');

        console.log('开始插入案件数据...');
        for (let i = 0; i < cases.length; i++) {
          const caseItem = cases[i];
          const id = uuidv4();
          const assignedLawyerId = caseItem.status !== 'pending' ? lawyerIds[i % lawyerIds.length] : null;
          
          await new Promise((res, rej) => {
            db.run(
              `INSERT INTO cases (id, case_number, title, opposing_party, case_domain, status, assigned_lawyer_id, priority, conflict_status, created_by, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'unverified', ?, ?, ?)`,
              [id, caseItem.case_number, caseItem.title, caseItem.opposing_party, caseItem.case_domain, caseItem.status, assignedLawyerId, caseItem.priority, caseItem.created_by, now, now],
              (err) => err ? rej(err) : res()
            );
          });

          await new Promise((res, rej) => {
            db.run(
              `INSERT INTO status_history (id, case_id, previous_status, new_status, changed_by, change_reason, created_at)
               VALUES (?, ?, NULL, ?, '系统', '案件创建', ?)`,
              [uuidv4(), id, caseItem.status, now],
              (err) => err ? rej(err) : res()
            );
          });

          let funnelStage = 'lead';
          if (caseItem.status === 'assigned') funnelStage = 'qualified';
          if (caseItem.status === 'in_progress') funnelStage = 'proposal';
          if (caseItem.status === 'completed') funnelStage = 'closed';

          await new Promise((res, rej) => {
            db.run(
              `INSERT INTO lead_funnel (id, case_id, stage, entered_at, notes)
               VALUES (?, ?, ?, ?, ?)`,
              [uuidv4(), id, funnelStage, now, '样例数据'],
              (err) => err ? rej(err) : res()
            );
          });

          if (assignedLawyerId) {
            await new Promise((res, rej) => {
              db.run(
                `UPDATE lawyers SET current_load = current_load + 1 WHERE id = ?`,
                [assignedLawyerId],
                (err) => err ? rej(err) : res()
              );
            });
          }
        }
        console.log('案件数据插入完成');

        console.log('数据库初始化完成');
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  });
};

seedDatabase()
  .then(() => {
    db.close();
    console.log('数据插入成功完成');
    process.exit(0);
  })
  .catch((err) => {
    console.error('数据插入失败:', err);
    db.close();
    process.exit(1);
  });
