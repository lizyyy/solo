const db = require('../config/database');
const ExcelJS = require('exceljs');
const { success, error, serverError } = require('../utils/responseHandler');

exports.getDashboardStats = (req, res) => {
  const sql = `
    SELECT 
      COUNT(DISTINCT ib.id) as total_batches,
      SUM(CASE WHEN ib.quality_status = 'passed' THEN ib.quantity ELSE 0 END) as available_quantity,
      SUM(CASE WHEN ib.quality_status = 'failed' THEN ib.quantity ELSE 0 END) as quarantined_quantity,
      SUM(CASE WHEN ib.quality_status = 'pending' THEN ib.quantity ELSE 0 END) as pending_quantity,
      SUM(ib.loss_quantity) as total_loss,
      SUM(ib.quantity + ib.loss_quantity) as total_harvested
    FROM inventory_batches ib
  `;
  
  db.get(sql, [], (err, summary) => {
    if (err) return serverError(res, err);
    
    const plotSql = `
      SELECT 
        p.id,
        p.name as plot_name,
        p.crop_type,
        COUNT(DISTINCT ht.id) as task_count,
        SUM(ib.quantity + ib.loss_quantity) as total_production,
        SUM(ib.quantity) as net_production,
        SUM(ib.loss_quantity) as total_loss,
        CASE 
          WHEN SUM(ib.quantity + ib.loss_quantity) > 0 
          THEN ROUND((SUM(ib.loss_quantity) / SUM(ib.quantity + ib.loss_quantity)) * 100, 2)
          ELSE 0 
        END as loss_rate,
        SUM(CASE WHEN ib.quality_status = 'passed' THEN ib.quantity ELSE 0 END) as available_stock,
        SUM(CASE WHEN ib.quality_status = 'failed' THEN ib.quantity ELSE 0 END) as quarantined_stock,
        COUNT(DISTINCT CASE WHEN ib.quality_status = 'passed' THEN ib.id END) as available_batches,
        COUNT(DISTINCT CASE WHEN ib.quality_status = 'failed' THEN ib.id END) as quarantined_batches
      FROM plots p
      LEFT JOIN harvest_tasks ht ON p.id = ht.plot_id
      LEFT JOIN inventory_batches ib ON ht.id = ib.harvest_task_id
      GROUP BY p.id, p.name, p.crop_type
      ORDER BY total_production DESC
    `;
    
    db.all(plotSql, [], (err, plots) => {
      if (err) return serverError(res, err);
      
      const gradeSql = `
        SELECT 
          g.id,
          g.name as grade_name,
          g.code,
          SUM(ib.quantity) as quantity,
          COUNT(ib.id) as batch_count
        FROM grades g
        LEFT JOIN inventory_batches ib ON g.id = ib.grade_id AND ib.quality_status = 'passed'
        GROUP BY g.id, g.name, g.code
        ORDER BY g.sort_order ASC
      `;
      
      db.all(gradeSql, [], (err, grades) => {
        if (err) return serverError(res, err);
        
        success(res, {
          summary,
          plots,
          grades
        });
      });
    });
  });
};

exports.getAvailableStock = (req, res) => {
  const sql = `
    SELECT 
      ib.*,
      ht.harvest_date,
      p.name as plot_name,
      hm.name as manager_name,
      g.name as grade_name,
      g.code as grade_code
    FROM inventory_batches ib
    LEFT JOIN harvest_tasks ht ON ib.harvest_task_id = ht.id
    LEFT JOIN plots p ON ht.plot_id = p.id
    LEFT JOIN harvest_managers hm ON ht.manager_id = hm.id
    LEFT JOIN grades g ON ib.grade_id = g.id
    WHERE ib.quality_status = 'passed' AND ib.status = 'available'
    ORDER BY ib.created_at DESC
  `;
  db.all(sql, [], (err, rows) => {
    if (err) return serverError(res, err);
    success(res, rows);
  });
};

exports.getQuarantinedStock = (req, res) => {
  const sql = `
    SELECT 
      ib.*,
      ht.harvest_date,
      p.name as plot_name,
      hm.name as manager_name,
      g.name as grade_name,
      g.code as grade_code,
      qi.result as inspection_result,
      qi.defects,
      qi.notes as inspection_notes
    FROM inventory_batches ib
    LEFT JOIN harvest_tasks ht ON ib.harvest_task_id = ht.id
    LEFT JOIN plots p ON ht.plot_id = p.id
    LEFT JOIN harvest_managers hm ON ht.manager_id = hm.id
    LEFT JOIN grades g ON ib.grade_id = g.id
    LEFT JOIN quality_inspections qi ON ib.id = qi.batch_id
    WHERE ib.quality_status = 'failed' OR ib.status = 'quarantined'
    ORDER BY ib.created_at DESC
  `;
  db.all(sql, [], (err, rows) => {
    if (err) return serverError(res, err);
    success(res, rows);
  });
};

exports.exportHarvestReport = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    let dateFilter = '';
    const params = [];
    
    if (start_date && end_date) {
      dateFilter = 'WHERE ht.harvest_date BETWEEN ? AND ?';
      params.push(start_date, end_date);
    }
    
    const sql = `
      SELECT 
        ib.batch_no,
        p.name as plot_name,
        ht.harvest_date,
        hm.name as manager_name,
        g.name as grade_name,
        ib.quantity,
        ib.loss_quantity,
        lr.name as loss_reason,
        ib.unit,
        ib.storage_location,
        ib.quality_status,
        ib.status,
        qi.result as inspection_result,
        qi.inspector,
        qi.inspection_date,
        ib.created_at
      FROM inventory_batches ib
      LEFT JOIN harvest_tasks ht ON ib.harvest_task_id = ht.id
      LEFT JOIN plots p ON ht.plot_id = p.id
      LEFT JOIN harvest_managers hm ON ht.manager_id = hm.id
      LEFT JOIN grades g ON ib.grade_id = g.id
      LEFT JOIN loss_reasons lr ON ib.loss_reason_id = lr.id
      LEFT JOIN quality_inspections qi ON ib.id = qi.batch_id
      ${dateFilter}
      ORDER BY ib.created_at DESC
    `;
    
    db.all(sql, params, async (err, rows) => {
      if (err) return serverError(res, err);
      
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('采收入库报表');
      
      worksheet.columns = [
        { header: '批次号', key: 'batch_no', width: 20 },
        { header: '地块', key: 'plot_name', width: 15 },
        { header: '采收日期', key: 'harvest_date', width: 12 },
        { header: '采收负责人', key: 'manager_name', width: 12 },
        { header: '等级', key: 'grade_name', width: 10 },
        { header: '入库数量', key: 'quantity', width: 12 },
        { header: '损耗数量', key: 'loss_quantity', width: 12 },
        { header: '损耗原因', key: 'loss_reason', width: 15 },
        { header: '单位', key: 'unit', width: 8 },
        { header: '库位', key: 'storage_location', width: 12 },
        { header: '质检状态', key: 'quality_status', width: 12 },
        { header: '库存状态', key: 'status', width: 12 },
        { header: '质检结果', key: 'inspection_result', width: 12 },
        { header: '质检员', key: 'inspector', width: 10 },
        { header: '质检日期', key: 'inspection_date', width: 20 },
        { header: '创建时间', key: 'created_at', width: 20 }
      ];
      
      worksheet.getRow(1).font = { bold: true };
      
      rows.forEach(row => {
        worksheet.addRow({
          batch_no: row.batch_no,
          plot_name: row.plot_name,
          harvest_date: row.harvest_date,
          manager_name: row.manager_name,
          grade_name: row.grade_name,
          quantity: row.quantity,
          loss_quantity: row.loss_quantity,
          loss_reason: row.loss_reason,
          unit: row.unit,
          storage_location: row.storage_location,
          quality_status: row.quality_status === 'passed' ? '通过' : row.quality_status === 'failed' ? '不通过' : '待检',
          status: row.status === 'available' ? '可售' : row.status === 'quarantined' ? '隔离' : '待处理',
          inspection_result: row.inspection_result === 'passed' ? '通过' : row.inspection_result === 'failed' ? '不通过' : '待检',
          inspector: row.inspector,
          inspection_date: row.inspection_date,
          created_at: row.created_at
        });
      });
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=采收入库报表.xlsx');
      
      await workbook.xlsx.write(res);
      res.end();
    });
  } catch (err) {
    serverError(res, err);
  }
};
