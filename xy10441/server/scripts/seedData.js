const pool = require('../config/database');
const bcrypt = require('bcryptjs');

async function seedData() {
  const client = await pool.connect();
  try {
    console.log('开始导入样例数据...');
    await client.query('BEGIN');
    
    const hashedPassword = await bcrypt.hash('password123', 10);
    
    await client.query(`
      INSERT INTO users (username, password, name, email, role) VALUES
      ('admin', $1, '系统管理员', 'admin@example.com', 'admin'),
      ('zhangsan', $1, '张三', 'zhangsan@example.com', 'sales'),
      ('lisi', $1, '李四', 'lisi@example.com', 'manager')
      ON CONFLICT (username) DO NOTHING
    `, [hashedPassword]);
    
    const usersResult = await client.query('SELECT id, username FROM users WHERE username IN ($1, $2, $3)', ['admin', 'zhangsan', 'lisi']);
    const users = {};
    usersResult.rows.forEach(u => users[u.username] = u.id);
    
    await client.query(`
      INSERT INTO customers (name, contact_person, contact_phone, contact_email, industry, created_by) VALUES
      ('北京科技创新有限公司', '王经理', '13800138001', 'wang@techcompany.com', '互联网', $1),
      ('上海金融服务集团', '李总', '13800138002', 'li@financegroup.com', '金融', $1),
      ('广州制造集团', '赵主管', '13800138003', 'zhao@manufacturing.com', '制造业', $1)
      ON CONFLICT DO NOTHING
    `, [users.admin]);
    
    const customersResult = await client.query('SELECT id, name FROM customers ORDER BY name');
    const customers = {};
    customersResult.rows.forEach(c => customers[c.name] = c.id);
    
    const projectsData = [
      { customer: '北京科技创新有限公司', name: 'ERP系统升级项目', description: '企业资源规划系统全面升级改造', created_by: users.zhangsan },
      { customer: '上海金融服务集团', name: '客户关系管理系统', description: 'CRM系统建设及运维服务', created_by: users.zhangsan },
      { customer: '广州制造集团', name: '员工培训系统建设', description: '企业培训平台建设及培训服务', created_by: users.lisi }
    ];
    
    for (const p of projectsData) {
      const projectResult = await client.query(`
        INSERT INTO projects (customer_id, name, description, created_by)
        SELECT $1, $2, $3, $4
        WHERE NOT EXISTS (SELECT 1 FROM projects WHERE customer_id = $1 AND name = $2)
        RETURNING id
      `, [customers[p.customer], p.name, p.description, p.created_by]);
      
      if (projectResult.rows.length > 0) {
        const projectId = projectResult.rows[0].id;
        
        if (p.name.includes('ERP')) {
          await seedSoftwareImplementationData(client, projectId, users.zhangsan);
        } else if (p.name.includes('CRM')) {
          await seedOperationServiceData(client, projectId, users.zhangsan);
        } else if (p.name.includes('培训')) {
          await seedTrainingPackageData(client, projectId, users.lisi);
        }
      }
    }
    
    await client.query('COMMIT');
    console.log('样例数据导入完成！');
    console.log('默认账号: admin / password123');
    console.log('默认账号: zhangsan / password123');
    console.log('默认账号: lisi / password123');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('导入样例数据失败:', error);
  } finally {
    client.release();
    process.exit();
  }
}

async function seedSoftwareImplementationData(client, projectId, userId) {
  const versionResult = await client.query(`
    INSERT INTO proposal_versions 
    (project_id, version_number, version_name, scope_description, total_amount, final_amount, status, created_by)
    VALUES ($1, '1.0', 'ERP系统升级-标准版方案', 
    '一、项目范围：1. 现有ERP系统数据迁移 2. 核心业务模块升级 3. 系统集成开发 4. 用户培训 5. 技术支持服务', 
    850000, 850000, 'draft', $2)
    RETURNING id
  `, [projectId, userId]);
  
  const versionId = versionResult.rows[0].id;
  
  await client.query(`
    INSERT INTO quotation_items (proposal_version_id, item_order, category, item_name, description, quantity, unit, unit_price, amount) VALUES
    ($1, 1, '软件实施', '需求调研与分析', '全面调研现有系统和业务流程', 1, '项', 80000, 80000),
    ($1, 2, '软件实施', '系统架构设计', '设计新系统技术架构', 1, '项', 120000, 120000),
    ($1, 3, '软件实施', '数据迁移开发', '数据清洗、转换、迁移', 1, '项', 150000, 150000),
    ($1, 4, '软件实施', '核心模块开发', '财务、采购、库存模块开发', 1, '项', 250000, 250000),
    ($1, 5, '软件实施', '系统集成', '与OA、HR系统集成', 1, '项', 100000, 100000),
    ($1, 6, '软件实施', '测试与部署', 'UAT测试、生产环境部署', 1, '项', 80000, 80000),
    ($1, 7, '软件实施', '培训服务', '管理员培训、用户培训', 1, '项', 50000, 50000),
    ($1, 8, '技术支持', '上线后3个月支持', '7x8小时技术支持', 3, '月', 7000, 21000)
  `, [versionId]);
  
  await client.query(`
    INSERT INTO attachments (proposal_version_id, file_name, is_required) VALUES
    ($1, '项目需求规格说明书.pdf', true),
    ($1, '技术架构设计.docx', true)
  `, [versionId]);
}

async function seedOperationServiceData(client, projectId, userId) {
  const versionResult = await client.query(`
    INSERT INTO proposal_versions 
    (project_id, version_number, version_name, scope_description, total_amount, discount_amount, final_amount, status, is_confirmed, confirmed_at, created_by)
    VALUES ($1, '2.0', 'CRM系统建设及运维服务-确认版', 
    '一、服务范围：1. CRM系统部署实施 2. 7x24小时运维保障 3. 系统优化升级 4. 数据备份与恢复 5. 安全防护', 
    1200000, 50000, 1150000, 'confirmed', true, CURRENT_TIMESTAMP, $2)
    RETURNING id
  `, [projectId, userId]);
  
  const versionId = versionResult.rows[0].id;
  
  await client.query(`
    INSERT INTO quotation_items (proposal_version_id, item_order, category, item_name, description, quantity, unit, unit_price, amount) VALUES
    ($1, 1, '运维服务', '系统部署实施', '服务器部署、配置、调试', 1, '项', 100000, 100000),
    ($1, 2, '运维服务', '7x24小时技术支持', '全天候技术响应', 12, '月', 25000, 300000),
    ($1, 3, '运维服务', '系统巡检', '每月一次全面系统巡检', 12, '次', 5000, 60000),
    ($1, 4, '运维服务', '性能优化', '定期系统性能调优', 4, '次', 15000, 60000),
    ($1, 5, '数据服务', '数据备份服务', '每日全量备份', 12, '月', 8000, 96000),
    ($1, 6, '数据服务', '灾备方案', '异地灾备方案实施', 1, '项', 80000, 80000),
    ($1, 7, '安全服务', '安全防护', '防火墙、入侵检测', 12, '月', 12000, 144000),
    ($1, 8, '安全服务', '安全审计', '季度安全审计报告', 4, '次', 10000, 40000),
    ($1, 9, '升级服务', '版本升级', '一年内免费升级', 1, '年', 80000, 80000),
    ($1, 10, '咨询服务', '业务咨询', 'CRM业务流程优化咨询', 1, '项', 120000, 120000),
    ($1, 11, '培训服务', '系统使用培训', '管理员及用户培训', 1, '项', 80000, 80000),
    ($1, 12, '云服务', '云资源租赁', '云服务器及存储', 12, '月', 5000, 60000)
  `, [versionId]);
  
  await client.query(`
    INSERT INTO confirmations (proposal_version_id, confirmer_name, confirmer_company, confirmation_method, confirmation_date, notes, created_by)
    VALUES ($1, '李总', '上海金融服务集团', '合同签字', CURRENT_DATE, '确认CRM运维服务方案，合同已签署', $2)
  `, [versionId, userId]);
  
  const v1Result = await client.query(`
    INSERT INTO proposal_versions 
    (project_id, version_number, version_name, scope_description, total_amount, final_amount, status, created_by)
    VALUES ($1, '1.0', 'CRM系统初步方案', '初步方案，已废弃', 1100000, 1100000, 'voided', $2)
    RETURNING id
  `, [projectId, userId]);
  
  await client.query(`
    INSERT INTO scope_changes (proposal_version_id, change_type, change_content, change_reason, created_by) VALUES
    ($1, '新增', '增加7x24小时技术支持服务', '客户要求更高级别的响应时间', $2),
    ($1, '新增', '增加异地灾备方案', '金融行业合规要求', $2),
    ($1, '调整', '服务周期从6个月延长至12个月', '客户年度预算调整', $2)
  `, [versionId, userId]);
}

async function seedTrainingPackageData(client, projectId, userId) {
  const versionResult = await client.query(`
    INSERT INTO proposal_versions 
    (project_id, version_number, version_name, scope_description, total_amount, final_amount, status, created_by)
    VALUES ($1, '1.0', '企业培训平台及服务套餐', 
    '一、培训平台建设 二、培训课程开发 三、讲师服务 四、管理咨询', 
    680000, 680000, 'draft', $2)
    RETURNING id
  `, [projectId, userId]);
  
  const versionId = versionResult.rows[0].id;
  
  await client.query(`
    INSERT INTO quotation_items (proposal_version_id, item_order, category, item_name, description, quantity, unit, unit_price, amount) VALUES
    ($1, 1, '平台建设', '在线培训平台', '包含课程管理、学习追踪等功能', 1, '套', 150000, 150000),
    ($1, 2, '平台建设', '移动端APP', 'iOS和Android学习端', 1, '套', 80000, 80000),
    ($1, 3, '课程开发', '新员工入职培训', '公司文化、规章制度培训', 1, '套', 30000, 30000),
    ($1, 4, '课程开发', '产品知识培训', '核心产品及技术培训', 1, '套', 50000, 50000),
    ($1, 5, '课程开发', '销售技能培训', '销售技巧和方法论', 1, '套', 60000, 60000),
    ($1, 6, '课程开发', '管理能力培训', '基层和中层管理培训', 1, '套', 80000, 80000),
    ($1, 7, '讲师服务', '高级讲师', '行业资深专家授课', 20, '天', 5000, 100000),
    ($1, 8, '讲师服务', '中级讲师', '经验丰富培训讲师', 30, '天', 3000, 90000),
    ($1, 9, '咨询服务', '培训体系咨询', '建立企业培训体系', 1, '项', 20000, 20000),
    ($1, 10, '技术支持', '平台维护', '一年平台维护服务', 1, '年', 20000, 20000)
  `, [versionId]);
}

seedData();
