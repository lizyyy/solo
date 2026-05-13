const XLSX = require('xlsx');
const { runQuery } = require('../database');

async function exportLicenses(filters = {}) {
  let sql = `
    SELECT 
      c.name as 公司名称,
      c.credit_code as 统一社会信用代码,
      lt.name as 证照类型,
      l.license_number as 证照编号,
      l.issue_date as 发证日期,
      l.expiry_date as 有效期至,
      l.annual_check_deadline as 年检截止日期,
      l.responsible_person as 负责人,
      l.responsible_phone as 联系电话,
      l.status as 状态,
      l.risk_level as 风险等级,
      l.created_at as 创建时间
    FROM licenses l
    JOIN companies c ON l.company_id = c.id
    JOIN license_types lt ON l.license_type_id = lt.id
    WHERE 1=1
  `;
  const params = [];

  if (filters.company_id) {
    sql += ' AND l.company_id = ?';
    params.push(filters.company_id);
  }
  if (filters.status) {
    sql += ' AND l.status = ?';
    params.push(filters.status);
  }

  sql += ' ORDER BY l.annual_check_deadline ASC';

  const data = await runQuery(sql, params);
  
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '证照列表');
  
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return buffer;
}

module.exports = { exportLicenses };
