const XLSX = require('xlsx');
const { runQuery, runExecute } = require('../database');
const { v4: uuidv4 } = require('uuid');
const { logOperation } = require('./licenseService');

async function importLicenses(filePath, operator) {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

  const results = {
    success: 0,
    failed: 0,
    errors: []
  };

  for (let i = 0; i < data.length; i++) {
    try {
      const row = data[i];
      
      let company = await runQuery('SELECT * FROM companies WHERE name = ?', [row['公司名称']]);
      if (company.length === 0) {
        const companyId = uuidv4();
        await runExecute(
          'INSERT INTO companies (id, name, credit_code) VALUES (?, ?, ?)',
          [companyId, row['公司名称'], row['统一社会信用代码'] || '']
        );
        company = await runQuery('SELECT * FROM companies WHERE id = ?', [companyId]);
      }

      let licenseType = await runQuery('SELECT * FROM license_types WHERE name = ?', [row['证照类型']]);
      if (licenseType.length === 0) {
        const typeId = uuidv4();
        await runExecute(
          'INSERT INTO license_types (id, name, code) VALUES (?, ?, ?)',
          [typeId, row['证照类型'], row['证照类型']]
        );
        licenseType = await runQuery('SELECT * FROM license_types WHERE id = ?', [typeId]);
      }

      const licenseId = uuidv4();
      await runExecute(
        `INSERT INTO licenses (id, company_id, license_type_id, license_number, issue_date,
         expiry_date, annual_check_deadline, responsible_person, responsible_phone)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [licenseId, company[0].id, licenseType[0].id, row['证照编号'] || '',
         row['发证日期'] || null, row['有效期至'] || null, row['年检截止日期'] || null,
         row['负责人'] || '', row['联系电话'] || '']
      );

      await logOperation(licenseId, 'import', 'success', operator || 'system',
        `导入证照记录: ${row['公司名称']} - ${row['证照类型']}`, null, null);
      
      results.success++;
    } catch (error) {
      results.failed++;
      results.errors.push(`行 ${i + 2}: ${error.message}`);
    }
  }

  return results;
}

module.exports = { importLicenses };
