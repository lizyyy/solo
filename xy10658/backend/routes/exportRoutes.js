const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const { DBUtils } = require('../utils/db');

router.get('/report', async (req, res) => {
  try {
    const { operator, startDate, endDate, type = 'all' } = req.query;
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('业务报表');
    
    let sql, params = [];
    
    if (type === 'all' || type === 'leases') {
      const leaseSheet = workbook.addWorksheet('租赁合同');
      leaseSheet.columns = [
        { header: '房间号', key: 'room_number', width: 15 },
        { header: '租户姓名', key: 'tenant_name', width: 15 },
        { header: '租户电话', key: 'tenant_phone', width: 15 },
        { header: '开始日期', key: 'start_date', width: 15 },
        { header: '结束日期', key: 'end_date', width: 15 },
        { header: '月租金', key: 'monthly_rent', width: 10 },
        { header: '押金金额', key: 'deposit_amount', width: 12 },
        { header: '状态', key: 'status', width: 10 },
        { header: '创建人', key: 'created_by', width: 12 },
        { header: '创建时间', key: 'created_at', width: 20 }
      ];
      
      let leaseSql = 'SELECT * FROM lease_contracts WHERE 1=1';
      let leaseParams = [];
      
      if (operator) {
        leaseSql += ' AND created_by LIKE ?';
        leaseParams.push(`%${operator}%`);
      }
      if (startDate) {
        leaseSql += ' AND created_at >= ?';
        leaseParams.push(startDate);
      }
      if (endDate) {
        leaseSql += ' AND created_at <= ?';
        leaseParams.push(endDate);
      }
      
      const leases = DBUtils.allQuery(leaseSql, leaseParams);
      leaseSheet.addRows(leases);
    }
    
    if (type === 'all' || type === 'deposits') {
      const depositSheet = workbook.addWorksheet('押金账本');
      depositSheet.columns = [
        { header: '房间号', key: 'room_number', width: 15 },
        { header: '租户姓名', key: 'tenant_name', width: 15 },
        { header: '交易类型', key: 'transaction_type', width: 20 },
        { header: '金额', key: 'amount', width: 12 },
        { header: '余额', key: 'balance', width: 12 },
        { header: '描述', key: 'description', width: 30 },
        { header: '创建人', key: 'created_by', width: 12 },
        { header: '创建时间', key: 'created_at', width: 20 }
      ];
      
      let depositSql = `
        SELECT dl.*, lc.room_number, lc.tenant_name 
        FROM deposit_ledgers dl
        LEFT JOIN lease_contracts lc ON dl.contract_id = lc.id
        WHERE 1=1
      `;
      let depositParams = [];
      
      if (operator) {
        depositSql += ' AND dl.created_by LIKE ?';
        depositParams.push(`%${operator}%`);
      }
      if (startDate) {
        depositSql += ' AND dl.created_at >= ?';
        depositParams.push(startDate);
      }
      if (endDate) {
        depositSql += ' AND dl.created_at <= ?';
        depositParams.push(endDate);
      }
      
      const deposits = DBUtils.allQuery(depositSql, depositParams);
      depositSheet.addRows(deposits);
    }
    
    if (type === 'all' || type === 'operations') {
      const logSheet = workbook.addWorksheet('操作日志');
      logSheet.columns = [
        { header: '模块', key: 'module', width: 15 },
        { header: '操作', key: 'operation', width: 15 },
        { header: '记录ID', key: 'record_id', width: 40 },
        { header: '旧值', key: 'old_value', width: 50 },
        { header: '新值', key: 'new_value', width: 50 },
        { header: '操作人', key: 'operator', width: 12 },
        { header: '操作时间', key: 'created_at', width: 20 }
      ];
      
      let logSql = 'SELECT * FROM operation_logs WHERE 1=1';
      let logParams = [];
      
      if (operator) {
        logSql += ' AND operator LIKE ?';
        logParams.push(`%${operator}%`);
      }
      if (startDate) {
        logSql += ' AND created_at >= ?';
        logParams.push(startDate);
      }
      if (endDate) {
        logSql += ' AND created_at <= ?';
        logParams.push(endDate);
      }
      
      const logs = DBUtils.allQuery(logSql, logParams);
      logSheet.addRows(logs);
    }
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=report.xlsx');
    
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
