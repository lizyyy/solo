const { allAsync, getAsync } = require('../database/connection');

const getDailyReport = async (req, res, next) => {
  try {
    const { date } = req.body;

    const inStockCount = await getAsync(
      'SELECT COUNT(*) as count FROM packages WHERE DATE(in_stock_time) = ?',
      [date]
    );

    const pickupCount = await getAsync(
      'SELECT COUNT(*) as count FROM packages WHERE DATE(pickup_time) = ? AND status = ?',
      [date, 'picked_up']
    );

    const exceptionCount = await getAsync(
      'SELECT COUNT(*) as count FROM exception_packages WHERE DATE(created_at) = ?',
      [date]
    );

    const exceptionByType = await allAsync(
      'SELECT exception_type, COUNT(*) as count FROM exception_packages WHERE DATE(created_at) = ? GROUP BY exception_type',
      [date]
    );

    const compensationTotal = await getAsync(
      'SELECT COALESCE(SUM(amount), 0) as total_amount, COUNT(*) as count FROM compensations WHERE DATE(paid_time) = ?',
      [date]
    );

    const pendingExceptions = await allAsync(
      'SELECT * FROM exception_packages WHERE status = ? ORDER BY created_at DESC LIMIT 10',
      ['pending']
    );

    res.json({
      success: true,
      data: {
        date,
        summary: {
          in_stock_count: inStockCount.count,
          pickup_count: pickupCount.count,
          exception_count: exceptionCount.count,
          compensation_count: compensationTotal.count,
          compensation_total_amount: compensationTotal.total_amount
        },
        exception_by_type: exceptionByType,
        pending_exceptions: pendingExceptions
      }
    });
  } catch (error) {
    next(error);
  }
};

const getOperationHistory = async (req, res, next) => {
  try {
    const { start_date, end_date, operation_type } = req.query;

    let sql = 'SELECT * FROM operation_history WHERE 1=1';
    let params = [];

    if (start_date) {
      sql += ' AND DATE(operation_time) >= ?';
      params.push(start_date);
    }

    if (end_date) {
      sql += ' AND DATE(operation_time) <= ?';
      params.push(end_date);
    }

    if (operation_type) {
      sql += ' AND operation_type = ?';
      params.push(operation_type);
    }

    sql += ' ORDER BY operation_time DESC LIMIT 100';

    const history = await allAsync(sql, params);

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDailyReport,
  getOperationHistory
};
