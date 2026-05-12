const { runAsync, getAsync, allAsync } = require('../database/connection');
const { AppError } = require('../middleware/errorHandler');
const { recordOperation } = require('../utils/operationHistory');

const inStock = async (req, res, next) => {
  try {
    const { waybill_no, receiver_name, receiver_phone, operator } = req.body;

    const existingPackage = await getAsync(
      'SELECT * FROM packages WHERE waybill_no = ?',
      [waybill_no]
    );

    if (existingPackage) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'DUPLICATE_WAYBILL',
          message: '该运单号已入库，不能重复入库',
          details: {
            waybill_no,
            in_stock_time: existingPackage.in_stock_time
          }
        }
      });
    }

    const result = await runAsync(
      'INSERT INTO packages (waybill_no, receiver_name, receiver_phone, status) VALUES (?, ?, ?, ?)',
      [waybill_no, receiver_name, receiver_phone, 'in_stock']
    );

    await recordOperation(
      result.lastID,
      waybill_no,
      'in_stock',
      operator,
      `包裹入库，收件人：${receiver_name}，电话：${receiver_phone}`
    );

    res.json({
      success: true,
      data: {
        package_id: result.lastID,
        waybill_no,
        receiver_name,
        receiver_phone,
        status: 'in_stock'
      }
    });
  } catch (error) {
    next(error);
  }
};

const pickup = async (req, res, next) => {
  try {
    const { waybill_no, operator } = req.body;

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

    if (pkg.status === 'picked_up') {
      return res.status(409).json({
        success: false,
        error: {
          code: 'PACKAGE_ALREADY_PICKED',
          message: '该包裹已被取走',
          details: {
            pickup_time: pkg.pickup_time
          }
        }
      });
    }

    const activeException = await getAsync(
      'SELECT * FROM exception_packages WHERE package_id = ? AND status IN (?, ?, ?)',
      [pkg.id, 'pending', 'confirmed', 'compensated']
    );

    if (activeException) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'PACKAGE_HAS_EXCEPTION',
          message: '该包裹存在异常，暂时无法取件，请联系工作人员处理',
          details: {
            exception_id: activeException.id,
            exception_type: activeException.exception_type,
            exception_status: activeException.status
          }
        }
      });
    }

    await runAsync(
      'UPDATE packages SET status = ?, pickup_time = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['picked_up', pkg.id]
    );

    await recordOperation(
      pkg.id,
      waybill_no,
      'pickup',
      operator,
      '包裹正常取件'
    );

    res.json({
      success: true,
      data: {
        package_id: pkg.id,
        waybill_no,
        status: 'picked_up'
      }
    });
  } catch (error) {
    next(error);
  }
};

const getPackageHistory = async (req, res, next) => {
  try {
    const { waybill_no } = req.params;

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

    const history = await allAsync(
      'SELECT * FROM operation_history WHERE waybill_no = ? ORDER BY operation_time DESC',
      [waybill_no]
    );

    const exceptions = await allAsync(
      'SELECT * FROM exception_packages WHERE waybill_no = ? ORDER BY created_at DESC',
      [waybill_no]
    );

    const compensations = await allAsync(
      'SELECT * FROM compensations WHERE waybill_no = ? ORDER BY created_at DESC',
      [waybill_no]
    );

    res.json({
      success: true,
      data: {
        package: pkg,
        operation_history: history,
        exceptions: exceptions.map(exception => ({
          ...exception,
          compensations: compensations.filter(c => c.exception_id === exception.id)
        }))
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  inStock,
  pickup,
  getPackageHistory
};
