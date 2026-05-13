const { initDatabase, runQuery, runExecute } = require('../database');
const { v4: uuidv4 } = require('uuid');

async function initData() {
  await initDatabase();
  console.log('数据库初始化完成');

  const existingCompanies = await runQuery('SELECT COUNT(*) as count FROM companies');
  if (existingCompanies[0].count > 0) {
    console.log('数据已存在，跳过初始化');
    return;
  }

  const companies = [
    { id: uuidv4(), name: '北京科技有限公司', credit_code: '91110000123456789A', registered_address: '北京市朝阳区xxx路xxx号', legal_representative: '张总' },
    { id: uuidv4(), name: '上海贸易集团', credit_code: '91310000987654321B', registered_address: '上海市浦东新区xxx路xxx号', legal_representative: '李总' },
    { id: uuidv4(), name: '广州制造股份', credit_code: '91440000112233445C', registered_address: '广州市天河区xxx路xxx号', legal_representative: '王总' }
  ];

  for (const company of companies) {
    await runExecute(
      'INSERT INTO companies (id, name, credit_code, registered_address, legal_representative) VALUES (?, ?, ?, ?, ?)',
      [company.id, company.name, company.credit_code, company.registered_address, company.legal_representative]
    );
  }
  console.log('公司数据初始化完成');

  const licenseTypes = [
    { id: uuidv4(), name: '营业执照', code: 'BUSINESS_LICENSE', description: '企业法人营业执照', validity_period: 3650 },
    { id: uuidv4(), name: '组织机构代码证', code: 'ORG_CODE', description: '组织机构代码证书', validity_period: 1825 },
    { id: uuidv4(), name: '税务登记证', code: 'TAX_REG', description: '税务登记证书', validity_period: 1825 },
    { id: uuidv4(), name: '资质等级证书', code: 'QUALIFICATION', description: '企业资质等级证书', validity_period: 1095 }
  ];

  for (const type of licenseTypes) {
    await runExecute(
      'INSERT INTO license_types (id, name, code, description, validity_period) VALUES (?, ?, ?, ?, ?)',
      [type.id, type.name, type.code, type.description, type.validity_period]
    );
  }
  console.log('证照类型初始化完成');

  const licenses = [
    {
      id: uuidv4(),
      company_id: companies[0].id,
      license_type_id: licenseTypes[0].id,
      license_number: '京123456',
      issue_date: '2020-01-15',
      expiry_date: '2030-01-14',
      annual_check_deadline: '2025-06-30',
      responsible_person: '赵小明',
      responsible_phone: '13800138001',
      status: 'pending',
      risk_level: 'medium'
    },
    {
      id: uuidv4(),
      company_id: companies[0].id,
      license_type_id: licenseTypes[3].id,
      license_number: '资质A123',
      issue_date: '2022-03-20',
      expiry_date: '2025-03-19',
      annual_check_deadline: '2025-03-01',
      responsible_person: '钱小红',
      responsible_phone: '13800138002',
      status: 'pending',
      risk_level: 'high'
    },
    {
      id: uuidv4(),
      company_id: companies[1].id,
      license_type_id: licenseTypes[0].id,
      license_number: '沪654321',
      issue_date: '2019-05-10',
      expiry_date: '2029-05-09',
      annual_check_deadline: '2025-05-31',
      responsible_person: '孙大伟',
      responsible_phone: '13900139001',
      status: 'completed',
      risk_level: 'low'
    },
    {
      id: uuidv4(),
      company_id: companies[2].id,
      license_type_id: licenseTypes[1].id,
      license_number: '粤987654',
      issue_date: '2021-08-01',
      expiry_date: '2026-07-31',
      annual_check_deadline: '2025-08-15',
      responsible_person: '周小兰',
      responsible_phone: '13700137001',
      status: 'reviewing',
      risk_level: 'low'
    }
  ];

  for (const license of licenses) {
    await runExecute(
      `INSERT INTO licenses (id, company_id, license_type_id, license_number, issue_date,
       expiry_date, annual_check_deadline, responsible_person, responsible_phone, status, risk_level)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [license.id, license.company_id, license.license_type_id, license.license_number,
       license.issue_date, license.expiry_date, license.annual_check_deadline,
       license.responsible_person, license.responsible_phone, license.status, license.risk_level]
    );
  }
  console.log('证照数据初始化完成');
  console.log('数据初始化全部完成！');
}

initData().catch(console.error);
