const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { Parser } = require('json2csv');
const xlsx = require('xlsx');
const moment = require('moment');

class ImportExportController {
  static async exportHazards(req, res) {
    const { status, team_id, risk_level, format = 'csv' } = req.query;
    
    let query = `SELECT h.id, h.description, h.location, h.risk_level, t.name as team_name, 
                        h.deadline, h.status, h.created_at
                 FROM hazards h 
                 LEFT JOIN teams t ON h.team_id = t.id 
                 WHERE 1=1`;
    let params = [];

    if (status) {
      query += ` AND h.status = ?`;
      params.push(status);
    }
    if (team_id) {
      query += ` AND h.team_id = ?`;
      params.push(team_id);
    }
    if (risk_level) {
      query += ` AND h.risk_level = ?`;
      params.push(risk_level);
    }

    query += ` ORDER BY h.created_at DESC`;

    db.all(query, params, (err, rows) => {
      if (err) {
        return res.status(500).json({ success: false, message: err.message });
      }

      const data = rows.map(row => ({
        ID: row.id,
        隐患描述: row.description,
        位置: row.location,
        风险等级: row.risk_level,
        责任班组: row.team_name,
        整改期限: row.deadline,
        状态: row.status,
        创建时间: row.created_at
      }));

      const filename = `安全隐患_${moment().format('YYYYMMDDHHmmss')}`;

      if (format === 'excel') {
        const worksheet = xlsx.utils.json_to_sheet(data);
        const workbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(workbook, worksheet, '隐患');
        const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}.xlsx`);
        res.send(buffer);
      } else {
        const parser = new Parser({ fields: Object.keys(data[0] || {}) });
        const csv = parser.parse(data);
        
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}.csv`);
        res.send('\uFEFF' + csv);
      }
    });
  }

  static async exportFines(req, res) {
    const { status, format = 'csv' } = req.query;
    
    let query = `SELECT f.id, h.description as hazard_description, t.name as team_name,
                        f.amount, f.reason, f.status, f.reviewed_by, f.created_at
                 FROM fines f 
                 LEFT JOIN hazards h ON f.hazard_id = h.id 
                 LEFT JOIN teams t ON h.team_id = t.id 
                 WHERE 1=1`;
    let params = [];

    if (status) {
      query += ` AND f.status = ?`;
      params.push(status);
    }

    query += ` ORDER BY f.created_at DESC`;

    db.all(query, params, (err, rows) => {
      if (err) {
        return res.status(500).json({ success: false, message: err.message });
      }

      const data = rows.map(row => ({
        ID: row.id,
        隐患描述: row.hazard_description,
        责任班组: row.team_name,
        罚款金额: row.amount,
        罚款原因: row.reason,
        状态: row.status,
        复核人: row.reviewed_by,
        创建时间: row.created_at
      }));

      const filename = `罚款记录_${moment().format('YYYYMMDDHHmmss')}`;

      if (format === 'excel') {
        const worksheet = xlsx.utils.json_to_sheet(data);
        const workbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(workbook, worksheet, '罚款');
        const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}.xlsx`);
        res.send(buffer);
      } else {
        const parser = new Parser({ fields: Object.keys(data[0] || {}) });
        const csv = parser.parse(data);
        
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}.csv`);
        res.send('\uFEFF' + csv);
      }
    });
  }

  static async importHazards(req, res) {
    if (!req.file) {
      return res.status(400).json({ success: false, message: '请上传文件' });
    }

    try {
      const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json(worksheet);

      const results = {
        success: 0,
        failed: 0,
        errors: []
      };

      for (const [index, row] of data.entries()) {
        try {
          const description = row['隐患描述'] || row['description'];
          const location = row['位置'] || row['location'] || '';
          const riskLevel = row['风险等级'] || row['risk_level'] || '中';
          const teamName = row['责任班组'] || row['team_name'];
          const deadline = row['整改期限'] || row['deadline'];

          if (!description) {
            results.failed++;
            results.errors.push(`第${index + 2}行: 隐患描述不能为空`);
            continue;
          }

          let teamId = null;
          if (teamName) {
            const team = await new Promise((resolve) => {
              db.get('SELECT id FROM teams WHERE name = ?', [teamName], (err, row) => {
                resolve(row);
              });
            });
            if (team) {
              teamId = team.id;
            }
          }

          const hazardId = uuidv4();
          await new Promise((resolve, reject) => {
            db.run(
              `INSERT INTO hazards (id, description, location, risk_level, team_id, deadline, status)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [hazardId, description, location, riskLevel, teamId, deadline || null, '待整改'],
              (err) => {
                if (err) reject(err);
                else resolve();
              }
            );
          });

          results.success++;
        } catch (error) {
          results.failed++;
          results.errors.push(`第${index + 2}行: ${error.message}`);
        }
      }

      res.json({
        success: true,
        message: `导入完成: 成功${results.success}条, 失败${results.failed}条`,
        results
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = ImportExportController;