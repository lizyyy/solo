const express = require('express');
const router = express.Router();
const { runQuery, runExecute } = require('../database');
const { v4: uuidv4 } = require('uuid');
const { logOperation, submitAnnualCheck } = require('../services/licenseService');

router.post('/success', async (req, res) => {
  try {
    const companies = await runQuery('SELECT * FROM companies LIMIT 1');
    const licenseTypes = await runQuery('SELECT * FROM license_types LIMIT 1');
    
    if (companies.length === 0 || licenseTypes.length === 0) {
      return res.status(400).json({ error: '请先运行初始化数据脚本' });
    }

    const licenseId = uuidv4();
    await runExecute(
      `INSERT INTO licenses (id, company_id, license_type_id, annual_check_deadline, 
       responsible_person, responsible_phone, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [licenseId, companies[0].id, licenseTypes[0].id, '2025-12-31', '张三', '13800138000', 'pending']
    );

    const attachmentId = uuidv4();
    await runExecute(
      'INSERT INTO attachments (id, license_id, file_name, file_path, status) VALUES (?, ?, ?, ?, ?)',
      [attachmentId, licenseId, '年检材料.pdf', '/uploads/test.pdf', 'approved']
    );

    const requestId = uuidv4();
    const result = await submitAnnualCheck(licenseId, {
      responsible_person: '张三',
      operator: 'demo_user'
    }, requestId);

    res.json({
      message: '成功路径演示 - 年检提交成功',
      licenseId,
      requestId,
      result
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/blocked', async (req, res) => {
  try {
    const companies = await runQuery('SELECT * FROM companies LIMIT 1');
    const licenseTypes = await runQuery('SELECT * FROM license_types LIMIT 1');

    const licenseId = uuidv4();
    await runExecute(
      `INSERT INTO licenses (id, company_id, license_type_id, annual_check_deadline, status) 
       VALUES (?, ?, ?, ?, ?)`,
      [licenseId, companies[0].id, licenseTypes[0].id, '2025-12-31', 'pending']
    );

    try {
      await submitAnnualCheck(licenseId, { operator: 'demo_user' }, uuidv4());
    } catch (error) {
      return res.json({
        message: '拦截路径演示 - 负责人信息缺失，提交被拦截',
        licenseId,
        error: error.message
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/manual', async (req, res) => {
  try {
    const companies = await runQuery('SELECT * FROM companies LIMIT 1');
    const licenseTypes = await runQuery('SELECT * FROM license_types LIMIT 1');

    const licenseId = uuidv4();
    await runExecute(
      `INSERT INTO licenses (id, company_id, license_type_id, annual_check_deadline, 
       responsible_person, responsible_phone, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [licenseId, companies[0].id, licenseTypes[0].id, '2025-12-31', '李四', '13900139000', 'pending']
    );

    const result = await submitAnnualCheck(licenseId, {
      responsible_person: '李四',
      operator: 'demo_user'
    }, uuidv4());

    res.json({
      message: '人工修正路径演示 - 缺少已审核附件，进入人工复核',
      licenseId,
      result
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/duplicate', async (req, res) => {
  try {
    const companies = await runQuery('SELECT * FROM companies LIMIT 1');
    const licenseTypes = await runQuery('SELECT * FROM license_types LIMIT 1');

    const licenseId = uuidv4();
    await runExecute(
      `INSERT INTO licenses (id, company_id, license_type_id, annual_check_deadline, 
       responsible_person, responsible_phone, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [licenseId, companies[0].id, licenseTypes[0].id, '2025-12-31', '王五', '13700137000', 'pending']
    );

    const attachmentId = uuidv4();
    await runExecute(
      'INSERT INTO attachments (id, license_id, file_name, file_path, status) VALUES (?, ?, ?, ?, ?)',
      [attachmentId, licenseId, '年检材料.pdf', '/uploads/test.pdf', 'approved']
    );

    const requestId = uuidv4();
    await submitAnnualCheck(licenseId, {
      responsible_person: '王五',
      operator: 'demo_user'
    }, requestId);

    const duplicateResult = await submitAnnualCheck(licenseId, {
      responsible_person: '王五',
      operator: 'demo_user'
    }, requestId);

    res.json({
      message: '重复提交通路演示 - 幂等性校验生效',
      licenseId,
      requestId,
      duplicateResult
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
