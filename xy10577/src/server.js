const express = require('express');
const path = require('path');
const fs = require('fs');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const services = require('./services');
const rules = require('./rules');
const utils = require('./utils');

const app = express();
const PORT = process.env.PORT || 3000;

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const exportsDir = path.join(__dirname, '..', 'exports');
if (!fs.existsSync(exportsDir)) {
  fs.mkdirSync(exportsDir, { recursive: true });
}

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: utils.nowString() });
});

const getOperator = (req) => req.headers['x-operator'] || 'system';
const getRequestId = (req) => req.headers['x-request-id'] || req.body?.request_id;

const handleError = async (res, error, operation, entityType = null, entityId = null, requestData = null) => {
  console.error(`[${operation}] Error:`, error);
  
  const statusCode = error.code ? 400 : 500;
  const errorCode = error.code || 'INTERNAL_ERROR';
  const message = error.message || '服务器内部错误';
  
  if (errorCode !== 'INTERNAL_ERROR') {
    await rules.recordFailedOperation(
      operation,
      getRequestId({ headers: {}, body: requestData }),
      entityType,
      entityId,
      errorCode,
      message,
      requestData
    );
  }
  
  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message: message
    }
  });
};

const wrap = (fn, operation, entityType = null) => {
  return async (req, res) => {
    try {
      const result = await fn(req);
      res.json({ success: true, data: result });
    } catch (error) {
      await handleError(res, error, operation, entityType, req.params?.id || req.body?.id, req.body);
    }
  };
};

app.post('/api/departments', wrap(async (req) => {
  return services.createDepartment(req.body, getOperator(req));
}, 'CREATE_DEPARTMENT', 'DEPARTMENT'));

app.get('/api/departments', wrap(async () => services.listDepartments(), 'LIST_DEPARTMENTS'));

app.get('/api/departments/:id', wrap(async (req) => {
  const dept = await services.getDepartment(req.params.id);
  if (!dept) throw { code: utils.ERROR_CODES.DEPARTMENT_NOT_FOUND, message: '部门不存在' };
  return dept;
}, 'GET_DEPARTMENT', 'DEPARTMENT'));

app.post('/api/stalls', wrap(async (req) => {
  return services.createStall(req.body);
}, 'CREATE_STALL', 'STALL'));

app.get('/api/stalls', wrap(async () => services.listStalls(), 'LIST_STALLS'));

app.post('/api/appointments', wrap(async (req) => {
  return services.createAppointment(req.body, getOperator(req), getRequestId(req));
}, 'CREATE_APPOINTMENT', 'APPOINTMENT'));

app.get('/api/appointments/:id', wrap(async (req) => {
  const appt = await services.getAppointment(req.params.id);
  if (!appt) throw { code: utils.ERROR_CODES.APPOINTMENT_NOT_FOUND, message: '预约不存在' };
  return appt;
}, 'GET_APPOINTMENT', 'APPOINTMENT'));

app.post('/api/appointments/:id/checkin', wrap(async (req) => {
  return services.checkInVisitor(req.params.id, getOperator(req));
}, 'CHECKIN_VISITOR', 'APPOINTMENT'));

app.post('/api/vouchers/issue', wrap(async (req) => {
  return services.issueVoucher(req.body, getOperator(req), getRequestId(req));
}, 'ISSUE_VOUCHER', 'VOUCHER'));

app.get('/api/vouchers', wrap(async (req) => {
  const filters = {};
  if (req.query.appointment_id) filters.appointment_id = req.query.appointment_id;
  if (req.query.department_id) filters.department_id = req.query.department_id;
  if (req.query.status) filters.status = req.query.status;
  if (req.query.voucher_code) filters.voucher_code = req.query.voucher_code;
  return services.listVouchers(filters);
}, 'LIST_VOUCHERS'));

app.get('/api/vouchers/:id', wrap(async (req) => {
  const voucher = await services.getVoucher(req.params.id);
  if (!voucher) throw { code: utils.ERROR_CODES.VOUCHER_NOT_FOUND, message: '餐券不存在' };
  return voucher;
}, 'GET_VOUCHER', 'VOUCHER'));

app.get('/api/vouchers/code/:code', wrap(async (req) => {
  const voucher = await services.getVoucherByCode(req.params.code);
  if (!voucher) throw { code: utils.ERROR_CODES.VOUCHER_NOT_FOUND, message: '餐券不存在' };
  return voucher;
}, 'GET_VOUCHER_BY_CODE', 'VOUCHER'));

app.post('/api/vouchers/redeem', wrap(async (req) => {
  return services.redeemVoucher(req.body, getOperator(req), getRequestId(req));
}, 'REDEEM_VOUCHER', 'VOUCHER'));

app.post('/api/vouchers/:id/void', wrap(async (req) => {
  return services.voidVoucher(req.params.id, req.body?.reason, getOperator(req));
}, 'VOID_VOUCHER', 'VOUCHER'));

app.post('/api/vouchers/expire', wrap(async () => {
  return services.expireVouchers();
}, 'EXPIRE_VOUCHERS'));

app.get('/api/visitors/:appointmentId/meal-status', wrap(async (req) => {
  const status = await services.getVisitorMealStatus(req.params.appointmentId);
  if (!status) throw { code: utils.ERROR_CODES.APPOINTMENT_NOT_FOUND, message: '预约不存在' };
  return status;
}, 'GET_VISITOR_MEAL_STATUS', 'APPOINTMENT'));

app.get('/api/departments/:id/expense', wrap(async (req) => {
  const result = await services.getDepartmentExpense(
    req.params.id,
    req.query.start_date,
    req.query.end_date
  );
  if (!result) throw { code: utils.ERROR_CODES.DEPARTMENT_NOT_FOUND, message: '部门不存在' };
  return result;
}, 'GET_DEPARTMENT_EXPENSE', 'DEPARTMENT'));

app.get('/api/stalls/:id/redemptions', wrap(async (req) => {
  const result = await services.getStallRedemptionDetails(
    req.params.id,
    req.query.start_date,
    req.query.end_date
  );
  if (!result) throw { code: utils.ERROR_CODES.STALL_NOT_FOUND, message: '档口不存在' };
  return result;
}, 'GET_STALL_REDEMPTIONS', 'STALL'));

app.get('/api/reports/monthly/:year/:month', wrap(async (req) => {
  return services.getMonthlyReport(parseInt(req.params.year), parseInt(req.params.month));
}, 'GET_MONTHLY_REPORT'));

app.get('/api/reports/monthly/:year/:month/export', async (req, res) => {
  try {
    const year = parseInt(req.params.year);
    const month = parseInt(req.params.month);
    const report = await services.getMonthlyReport(year, month);
    
    const deptCsvPath = path.join(exportsDir, `monthly-${year}-${month}-departments.csv`);
    const stallCsvPath = path.join(exportsDir, `monthly-${year}-${month}-stalls.csv`);
    const failedCsvPath = path.join(exportsDir, `monthly-${year}-${month}-failed.csv`);
    
    const deptWriter = createCsvWriter({
      path: deptCsvPath,
      header: [
        { id: 'department_id', title: '部门ID' },
        { id: 'department_name', title: '部门名称' },
        { id: 'issued', title: '发券数' },
        { id: 'redeemed', title: '核销数' },
        { id: 'voided', title: '作废物' },
        { id: 'expired', title: '过期数' },
        { id: 'issued_amount', title: '发券金额' },
        { id: 'redeemed_amount', title: '核销金额' }
      ]
    });
    await deptWriter.writeRecords(report.by_department);
    
    const stallWriter = createCsvWriter({
      path: stallCsvPath,
      header: [
        { id: 'stall_id', title: '档口ID' },
        { id: 'stall_name', title: '档口名称' },
        { id: 'count', title: '核销次数' },
        { id: 'amount', title: '核销金额' }
      ]
    });
    await stallWriter.writeRecords(report.by_stall);
    
    const failedWriter = createCsvWriter({
      path: failedCsvPath,
      header: [
        { id: 'operation', title: '操作' },
        { id: 'error_code', title: '错误码' },
        { id: 'error_message', title: '错误信息' },
        { id: 'created_at', title: '时间' }
      ]
    });
    await failedWriter.writeRecords(report.failed_operations);
    
    res.json({
      success: true,
      data: {
        period: report.period,
        summary: report.summary,
        exported_files: [
          path.basename(deptCsvPath),
          path.basename(stallCsvPath),
          path.basename(failedCsvPath)
        ]
      }
    });
  } catch (error) {
    await handleError(res, error, 'EXPORT_MONTHLY_REPORT');
  }
});

app.get('/api/failed-operations', wrap(async (req) => {
  return rules.getFailedOperations({
    operation: req.query.operation,
    error_code: req.query.error_code,
    entity_id: req.query.entity_id
  });
}, 'GET_FAILED_OPERATIONS'));

app.get('/api/history/:entityType/:entityId', wrap(async (req) => {
  return rules.getStatusHistory(req.params.entityType, req.params.entityId);
}, 'GET_STATUS_HISTORY'));

const startServer = async () => {
  await services.ensureDb();
  
  app.listen(PORT, () => {
    console.log(`访客餐券 API 服务已启动`);
    console.log(`本地地址: http://localhost:${PORT}`);
    console.log(`健康检查: http://localhost:${PORT}/health`);
    console.log(`数据目录: ${dataDir}`);
    console.log(`导出目录: ${exportsDir}`);
  });
};

startServer().catch(err => {
  console.error('启动失败:', err);
  process.exit(1);
});

module.exports = app;
