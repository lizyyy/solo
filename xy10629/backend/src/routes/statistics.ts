import express from 'express';
import { get, all } from '../database';
import ExcelJS from 'exceljs';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const totalPackages = await get('SELECT COUNT(*) as count FROM instrument_packages');
    const totalRecovery = await get('SELECT COUNT(*) as count FROM recovery_records');
    const totalCleaning = await get('SELECT COUNT(*) as count FROM cleaning_records');
    const totalSterilization = await get('SELECT COUNT(*) as count FROM sterilization_batches');
    const totalDistribution = await get('SELECT COUNT(*) as count FROM department_distributions');
    
    const pendingCleaning = await get('SELECT COUNT(*) as count FROM cleaning_records WHERE result = "pending"');
    const failedCleaning = await get('SELECT COUNT(*) as count FROM cleaning_records WHERE result = "failed"');
    const failedSterilization = await get('SELECT COUNT(*) as count FROM sterilization_batches WHERE result = "failed"');
    const activeIsolations = await get('SELECT COUNT(*) as count FROM failure_isolations WHERE status = "isolated"');

    const departments = await all(`
      SELECT department, COUNT(*) as count 
      FROM recovery_records 
      GROUP BY department 
      ORDER BY count DESC 
      LIMIT 5
    `);

    const handlers = await all(`
      SELECT receiver as name, COUNT(*) as count 
      FROM recovery_records 
      GROUP BY receiver 
      ORDER BY count DESC 
      LIMIT 5
    `);

    res.json({
      success: true,
      data: {
        totalPackages: totalPackages?.count || 0,
        totalRecovery: totalRecovery?.count || 0,
        totalCleaning: totalCleaning?.count || 0,
        totalSterilization: totalSterilization?.count || 0,
        totalDistribution: totalDistribution?.count || 0,
        pendingCleaning: pendingCleaning?.count || 0,
        failedCleaning: failedCleaning?.count || 0,
        failedSterilization: failedSterilization?.count || 0,
        activeIsolations: activeIsolations?.count || 0,
        topDepartments: departments,
        topHandlers: handlers
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

router.get('/anomalies', async (req, res) => {
  try {
    const failedCleaning = await all(`
      SELECT c.*, r.recovery_no, p.package_no, p.name as package_name
      FROM cleaning_records c
      LEFT JOIN recovery_records r ON c.recovery_id = r.id
      LEFT JOIN instrument_packages p ON r.package_id = p.id
      WHERE c.result = 'failed'
      ORDER BY c.created_at DESC
    `);

    const failedSterilization = await all(`
      SELECT * FROM sterilization_batches 
      WHERE result = 'failed'
      ORDER BY created_at DESC
    `);

    const activeIsolations = await all(`
      SELECT * FROM failure_isolations 
      WHERE status = 'isolated'
      ORDER BY created_at DESC
    `);

    res.json({
      success: true,
      data: {
        failedCleaning,
        failedSterilization,
        activeIsolations
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

router.get('/report', async (req, res) => {
  try {
    const { startDate, endDate, handler, reportType } = req.query;
    
    let recoverySql = `
      SELECT r.*, p.package_no, p.name as package_name
      FROM recovery_records r
      LEFT JOIN instrument_packages p ON r.package_id = p.id
      WHERE 1=1
    `;
    const recoveryParams: any[] = [];

    if (startDate) {
      recoverySql += ' AND r.recovery_time >= ?';
      recoveryParams.push(startDate);
    }
    if (endDate) {
      recoverySql += ' AND r.recovery_time <= ?';
      recoveryParams.push(endDate);
    }
    if (handler) {
      recoverySql += ' AND r.receiver = ?';
      recoveryParams.push(handler);
    }
    recoverySql += ' ORDER BY r.created_at DESC';

    let cleaningSql = `
      SELECT c.*, r.recovery_no, p.package_no, p.name as package_name
      FROM cleaning_records c
      LEFT JOIN recovery_records r ON c.recovery_id = r.id
      LEFT JOIN instrument_packages p ON r.package_id = p.id
      WHERE 1=1
    `;
    const cleaningParams: any[] = [];

    if (startDate) {
      cleaningSql += ' AND c.start_time >= ?';
      cleaningParams.push(startDate);
    }
    if (endDate) {
      cleaningSql += ' AND c.end_time <= ?';
      cleaningParams.push(endDate);
    }
    if (handler) {
      cleaningSql += ' AND c.cleaner = ?';
      cleaningParams.push(handler);
    }
    cleaningSql += ' ORDER BY c.created_at DESC';

    let distributionSql = `
      SELECT d.*, p.package_no, p.name as package_name
      FROM department_distributions d
      LEFT JOIN instrument_packages p ON d.package_id = p.id
      WHERE 1=1
    `;
    const distributionParams: any[] = [];

    if (startDate) {
      distributionSql += ' AND d.distribution_time >= ?';
      distributionParams.push(startDate);
    }
    if (endDate) {
      distributionSql += ' AND d.distribution_time <= ?';
      distributionParams.push(endDate);
    }
    if (handler) {
      distributionSql += ' AND d.distributor = ?';
      distributionParams.push(handler);
    }
    distributionSql += ' ORDER BY d.created_at DESC';

    const [recoveryRecords, cleaningRecords, distributionRecords] = await Promise.all([
      all(recoverySql, recoveryParams),
      all(cleaningSql, cleaningParams),
      all(distributionSql, distributionParams)
    ]);

    res.json({
      success: true,
      data: {
        recoveryRecords,
        cleaningRecords,
        distributionRecords
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

router.get('/export', async (req, res) => {
  try {
    const { startDate, endDate, handler, reportType } = req.query;
    
    let sql = `
      SELECT 
        r.recovery_no,
        p.package_no,
        p.name as package_name,
        r.department,
        r.recovery_time,
        r.receiver as handler,
        c.cleaning_method,
        c.start_time as cleaning_start,
        c.end_time as cleaning_end,
        c.result as cleaning_result,
        d.distribution_time,
        d.distributor,
        r.notes
      FROM recovery_records r
      LEFT JOIN instrument_packages p ON r.package_id = p.id
      LEFT JOIN cleaning_records c ON r.id = c.recovery_id
      LEFT JOIN department_distributions d ON p.id = d.package_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (startDate) {
      sql += ' AND r.recovery_time >= ?';
      params.push(startDate);
    }
    if (endDate) {
      sql += ' AND r.recovery_time <= ?';
      params.push(endDate);
    }
    if (handler) {
      sql += ' AND r.receiver = ?';
      params.push(handler);
    }
    sql += ' ORDER BY r.created_at DESC';

    const records = await all(sql, params);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('消毒追溯报表');

    worksheet.columns = [
      { header: '回收编号', key: 'recovery_no', width: 15 },
      { header: '器械包编号', key: 'package_no', width: 15 },
      { header: '器械包名称', key: 'package_name', width: 20 },
      { header: '科室', key: 'department', width: 15 },
      { header: '回收时间', key: 'recovery_time', width: 20 },
      { header: '处理人', key: 'handler', width: 12 },
      { header: '清洗方式', key: 'cleaning_method', width: 15 },
      { header: '清洗开始', key: 'cleaning_start', width: 20 },
      { header: '清洗结束', key: 'cleaning_end', width: 20 },
      { header: '清洗结果', key: 'cleaning_result', width: 12 },
      { header: '发放时间', key: 'distribution_time', width: 20 },
      { header: '发放人', key: 'distributor', width: 12 },
      { header: '备注', key: 'notes', width: 30 }
    ];

    worksheet.getRow(1).font = { bold: true };

    records.forEach(record => {
      worksheet.addRow(record);
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=sterilization_report_${Date.now()}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

export default router;
