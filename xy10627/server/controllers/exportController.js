const ExcelJS = require('exceljs');
const db = require('../database/db');

class ExportController {
  static exportToExcel(req, res) {
    const { responsible_person, start_date, end_date, status } = req.query;
    let query = 'SELECT * FROM inspections WHERE 1=1';
    const params = [];

    if (responsible_person) {
      query += ' AND responsible_person = ?';
      params.push(responsible_person);
    }

    if (start_date) {
      query += ' AND created_at >= ?';
      params.push(start_date);
    }

    if (end_date) {
      query += ' AND created_at <= ?';
      params.push(end_date);
    }

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';

    db.all(query, params, async (err, rows) => {
      if (err) {
        return res.status(500).json({ success: false, message: err.message });
      }

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('巡检记录');

      worksheet.columns = [
        { header: '巡检编号', key: 'inspection_no', width: 20 },
        { header: '植物区域', key: 'plant_area', width: 20 },
        { header: '原植物区域', key: 'plant_area_before', width: 20 },
        { header: '病虫害等级', key: 'pest_level', width: 15 },
        { header: '原病虫害等级', key: 'pest_level_before', width: 15 },
        { header: '漏巡扣分', key: 'missed_inspection_points', width: 12 },
        { header: '原漏巡扣分', key: 'missed_inspection_points_before', width: 12 },
        { header: '责任人', key: 'responsible_person', width: 15 },
        { header: '外包评分', key: 'outsourced_score', width: 12 },
        { header: '补苗验收状态', key: 'seedling_acceptance_status', width: 18 },
        { header: '状态', key: 'status', width: 15 },
        { header: '创建时间', key: 'created_at', width: 20 },
        { header: '更新时间', key: 'updated_at', width: 20 }
      ];

      worksheet.getRow(1).font = { bold: true };

      rows.forEach(row => {
        worksheet.addRow(row);
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=inspections.xlsx');

      await workbook.xlsx.write(res);
      res.end();
    });
  }

  static getMaintenanceTrend(req, res) {
    db.all(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        AVG(outsourced_score) as avg_score,
        SUM(missed_inspection_points) as total_points
      FROM inspections
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 30
    `, (err, rows) => {
      if (err) {
        return res.status(500).json({ success: false, message: err.message });
      }
      res.json({ success: true, data: rows });
    });
  }
}

module.exports = ExportController;
