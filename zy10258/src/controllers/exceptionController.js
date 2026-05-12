const { runAsync, getAsync, allAsync } = require('../database/connection');
const { recordOperation } = require('../utils/operationHistory');

const reportException = async (req, res, next) => {
  try {
    const { waybill_no, exception_type, exception_desc, operator } = req.body;

    const pkg = await getAsync(
      'SELECT * FROM packages WHERE waybill_no = ?',
      [waybill_no]
    );

    if (!pkg) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PACKAGE_NOT_FOUND',
          message: '未找到该运单号的包裹'
        }
      });
    }

    const activeException = await getAsync(
      'SELECT * FROM exception_packages WHERE package_id = ? AND status IN (?, ?, ?)',
      [pkg.id, 'pending', 'confirmed', 'compensated']
    );

    if (activeException) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'EXCEPTION_ALREADY_EXISTS',
          message: '该包裹已有未处理的异常',
          details: {
            exception_id: activeException.id,
            exception_type: activeException.exception_type,
            status: activeException.status
          }
        }
      });
    }

    const result = await runAsync(
      'INSERT INTO exception_packages (package_id, waybill_no, exception_type, exception_desc, reported_by, status) VALUES (?, ?, ?, ?, ?, ?)',
      [pkg.id, waybill_no, exception_type, exception_desc, operator, 'pending']
    );

    await recordOperation(
      pkg.id,
      waybill_no,
      'report_exception',
      operator,
      `异常上报：${exception_type} - ${exception_desc || '无描述'}`
    );

    res.json({
      success: true,
      data: {
        exception_id: result.lastID,
        package_id: pkg.id,
        waybill_no,
        exception_type,
        exception_desc,
        status: 'pending'
      }
    });
  } catch (error) {
    next(error);
  }
};

const confirmResponsibility = async (req, res, next) => {
  try {
    const { exception_id, responsible_party, operator } = req.body;

    const exception = await getAsync(
      'SELECT * FROM exception_packages WHERE id = ?',
      [exception_id]
    );

    if (!exception) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'EXCEPTION_NOT_FOUND',
          message: '未找到该异常记录'
        }
      });
    }

    if (exception.status === 'closed' || exception.status === 'compensated') {
      return res.status(409).json({
        success: false,
        error: {
          code: 'EXCEPTION_ALREADY_FINALIZED',
          message: '该异常已赔付或关闭，不能重复确认责任'
        }
      });
    }

    if (exception.status === 'confirmed') {
      return res.status(409).json({
        success: false,
        error: {
          code: 'RESPONSIBILITY_ALREADY_CONFIRMED',
          message: '该异常责任已确认',
          details: {
            responsible_party: exception.responsible_party,
            confirmed_time: exception.confirmed_time
          }
        }
      });
    }

    await runAsync(
      'UPDATE exception_packages SET status = ?, responsible_party = ?, confirmed_by = ?, confirmed_time = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['confirmed', responsible_party, operator, exception_id]
    );

    await recordOperation(
      exception.package_id,
      exception.waybill_no,
      'confirm_responsibility',
      operator,
      `责任确认：责任方为 ${responsible_party}`
    );

    res.json({
      success: true,
      data: {
        exception_id,
        status: 'confirmed',
        responsible_party
      }
    });
  } catch (error) {
    next(error);
  }
};

const closeException = async (req, res, next) => {
  try {
    const { exception_id, operator } = req.body;

    const exception = await getAsync(
      'SELECT * FROM exception_packages WHERE id = ?',
      [exception_id]
    );

    if (!exception) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'EXCEPTION_NOT_FOUND',
          message: '未找到该异常记录'
        }
      });
    }

    if (exception.status === 'closed') {
      return res.status(409).json({
        success: false,
        error: {
          code: 'EXCEPTION_ALREADY_CLOSED',
          message: '该异常已关闭'
        }
      });
    }

    if (exception.status === 'pending') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'RESPONSIBILITY_NOT_CONFIRMED',
          message: '责任未确认，不能关闭异常。请先确认责任方'
        }
      });
    }

    await runAsync(
      'UPDATE exception_packages SET status = ?, closed_by = ?, closed_time = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['closed', operator, exception_id]
    );

    await recordOperation(
      exception.package_id,
      exception.waybill_no,
      'close_exception',
      operator,
      '异常关闭'
    );

    res.json({
      success: true,
      data: {
        exception_id,
        status: 'closed'
      }
    });
  } catch (error) {
    next(error);
  }
};

const compensate = async (req, res, next) => {
  try {
    const { exception_id, amount, compensation_reason, operator } = req.body;

    const exception = await getAsync(
      'SELECT * FROM exception_packages WHERE id = ?',
      [exception_id]
    );

    if (!exception) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'EXCEPTION_NOT_FOUND',
          message: '未找到该异常记录'
        }
      });
    }

    if (exception.status === 'closed') {
      return res.status(409).json({
        success: false,
        error: {
          code: 'EXCEPTION_ALREADY_CLOSED',
          message: '该异常已关闭，不能进行赔付'
        }
      });
    }

    if (exception.status === 'pending') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'RESPONSIBILITY_NOT_CONFIRMED',
          message: '责任未确认，不能进行赔付。请先确认责任方'
        }
      });
    }

    const existingCompensation = await getAsync(
      'SELECT * FROM compensations WHERE exception_id = ?',
      [exception_id]
    );

    if (existingCompensation) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'COMPENSATION_ALREADY_PAID',
          message: '该异常已进行过赔付，不能重复赔付',
          details: {
            compensation_id: existingCompensation.id,
            amount: existingCompensation.amount,
            paid_time: existingCompensation.paid_time
          }
        }
      });
    }

    const result = await runAsync(
      'INSERT INTO compensations (exception_id, package_id, waybill_no, amount, compensation_reason, paid_by) VALUES (?, ?, ?, ?, ?, ?)',
      [exception_id, exception.package_id, exception.waybill_no, amount, compensation_reason, operator]
    );

    await runAsync(
      'UPDATE exception_packages SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['compensated', exception_id]
    );

    await recordOperation(
      exception.package_id,
      exception.waybill_no,
      'compensation',
      operator,
      `赔付完成：金额 ${amount} 元，原因：${compensation_reason || '无'}`
    );

    res.json({
      success: true,
      data: {
        compensation_id: result.lastID,
        exception_id,
        amount,
        status: 'compensated'
      }
    });
  } catch (error) {
    next(error);
  }
};

const getExceptionList = async (req, res, next) => {
  try {
    const { status } = req.query;
    
    let sql = 'SELECT * FROM exception_packages';
    let params = [];
    
    if (status) {
      sql += ' WHERE status = ?';
      params.push(status);
    }
    sql += ' ORDER BY created_at DESC';

    const exceptions = await allAsync(sql, params);

    res.json({
      success: true,
      data: exceptions
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  reportException,
  confirmResponsibility,
  closeException,
  compensate,
  getExceptionList
};
