const { Parser } = require('json2csv');
const db = require('../database/schema');

function buildExportQuery(filters) {
  let sql = `
    SELECT 
      r.id as '记录ID',
      r.record_no as '记录编号',
      r.cable_car_no as '缆车编号',
      r.inspection_item as '检修项目',
      r.inspection_date as '检修日期',
      r.inspector as '检修人员',
      r.inspection_result as '检修结果',
      CASE WHEN r.is_key_item = 1 THEN '是' ELSE '否' END as '是否关键项',
      r.trial_run_hours as '试运行时长(小时)',
      CASE r.status 
        WHEN 'pending' THEN '待处理'
        WHEN 'processed' THEN '已放行'
        WHEN 'returned' THEN '已退回'
        WHEN 'supplement' THEN '待补材料'
        ELSE r.status 
      END as '状态',
      CASE r.approval_status 
        WHEN 'pending' THEN '待审批'
        WHEN 'approved' THEN '已通过'
        WHEN 'rejected' THEN '已拒绝'
        ELSE r.approval_status 
      END as '审批状态',
      b.batch_no as '批次编号',
      b.created_by as '批次创建人',
      b.created_at as '批次创建时间',
      r.created_at as '记录创建时间',
      r.updated_at as '记录更新时间'
    FROM inspection_records r
    LEFT JOIN batches b ON r.batch_id = b.id
    WHERE 1=1
  `;
  const params = [];

  if (filters.cableCarNo) {
    sql += ` AND r.cable_car_no LIKE ?`;
    params.push(`%${filters.cableCarNo}%`);
  }

  if (filters.inspectionItem) {
    sql += ` AND r.inspection_item LIKE ?`;
    params.push(`%${filters.inspectionItem}%`);
  }

  if (filters.status) {
    sql += ` AND r.status = ?`;
    params.push(filters.status);
  }

  if (filters.startDate) {
    sql += ` AND r.inspection_date >= ?`;
    params.push(filters.startDate);
  }

  if (filters.endDate) {
    sql += ` AND r.inspection_date <= ?`;
    params.push(filters.endDate);
  }

  sql += ` ORDER BY r.created_at DESC`;

  return { sql, params };
}

function exportToCSV(filters) {
  return new Promise((resolve, reject) => {
    const { sql, params } = buildExportQuery(filters);
    
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }

      if (rows.length === 0) {
        resolve({ count: 0, csv: '' });
        return;
      }

      try {
        const fields = Object.keys(rows[0]);
        const json2csvParser = new Parser({ fields });
        const csv = json2csvParser.parse(rows);
        
        resolve({
          count: rows.length,
          csv
        });
      } catch (csvErr) {
        reject(csvErr);
      }
    });
  });
}

function exportRecordDetail(recordId) {
  return new Promise((resolve, reject) => {
    const recordSql = `
      SELECT 
        r.id as '记录ID',
        r.record_no as '记录编号',
        r.cable_car_no as '缆车编号',
        r.inspection_item as '检修项目',
        r.inspection_date as '检修日期',
        r.inspector as '检修人员',
        r.inspection_result as '检修结果',
        CASE WHEN r.is_key_item = 1 THEN '是' ELSE '否' END as '是否关键项',
        r.trial_run_hours as '试运行时长(小时)',
        CASE r.status 
          WHEN 'pending' THEN '待处理'
          WHEN 'processed' THEN '已放行'
          WHEN 'returned' THEN '已退回'
          WHEN 'supplement' THEN '待补材料'
          ELSE r.status 
        END as '状态',
        b.batch_no as '批次编号',
        b.created_by as '批次创建人',
        b.source_file as '来源文件'
      FROM inspection_records r
      LEFT JOIN batches b ON r.batch_id = b.id
      WHERE r.id = ?
    `;

    const logSql = `
      SELECT 
        operation_type as '操作类型',
        operator as '操作人',
        operation_time as '操作时间',
        reason as '原因',
        remark as '备注',
        previous_status as '原状态',
        new_status as '新状态'
      FROM operation_logs
      WHERE record_id = ?
      ORDER BY operation_time ASC
    `;

    const exceptionSql = `
      SELECT 
        exception_type as '异常类型',
        reason as '异常原因',
        handler as '处理人',
        handle_time as '处理时间',
        handle_result as '处理结果'
      FROM exception_records
      WHERE record_id = ?
      ORDER BY handle_time ASC
    `;

    db.get(recordSql, [recordId], (err, record) => {
      if (err) {
        reject(err);
        return;
      }

      db.all(logSql, [recordId], (err, logs) => {
        if (err) {
          reject(err);
          return;
        }

        db.all(exceptionSql, [recordId], (err, exceptions) => {
          if (err) {
            reject(err);
            return;
          }

          let result = '【基本信息】\n';
          if (record) {
            Object.keys(record).forEach(key => {
              result += `${key}: ${record[key] || '-'}\n`;
            });
          }

          result += '\n【操作日志】\n';
          if (logs.length > 0) {
            const logFields = Object.keys(logs[0]);
            result += logFields.join('\t') + '\n';
            logs.forEach(log => {
              result += logFields.map(f => log[f] || '-').join('\t') + '\n';
            });
          } else {
            result += '无操作日志\n';
          }

          result += '\n【异常记录】\n';
          if (exceptions.length > 0) {
            const expFields = Object.keys(exceptions[0]);
            result += expFields.join('\t') + '\n';
            exceptions.forEach(exp => {
              result += expFields.map(f => exp[f] || '-').join('\t') + '\n';
            });
          } else {
            result += '无异常记录\n';
          }

          resolve({
            record,
            logs,
            exceptions,
            content: result
          });
        });
      });
    });
  });
}

function exportOperationLogsByOperator(operator) {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        ol.operation_time as '操作时间',
        ol.operation_type as '操作类型',
        ol.operator as '操作人',
        r.record_no as '记录编号',
        r.cable_car_no as '缆车编号',
        r.inspection_item as '检修项目',
        b.batch_no as '批次编号',
        ol.reason as '原因',
        ol.remark as '备注',
        ol.previous_status as '原状态',
        ol.new_status as '新状态'
      FROM operation_logs ol
      LEFT JOIN inspection_records r ON ol.record_id = r.id
      LEFT JOIN batches b ON ol.source_batch_id = b.id
      WHERE ol.operator LIKE ?
      ORDER BY ol.operation_time DESC
    `;

    db.all(sql, [`%${operator}%`], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }

      if (rows.length === 0) {
        resolve({ count: 0, csv: '' });
        return;
      }

      try {
        const fields = Object.keys(rows[0]);
        const json2csvParser = new Parser({ fields });
        const csv = json2csvParser.parse(rows);
        
        resolve({
          count: rows.length,
          csv
        });
      } catch (csvErr) {
        reject(csvErr);
      }
    });
  });
}

module.exports = {
  exportToCSV,
  exportRecordDetail,
  exportOperationLogsByOperator
};
