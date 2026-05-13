const db = require('../config/database');

const checkBatteryLevel = (deviceId, minBattery = 20) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT battery_level FROM devices WHERE id = ?', [deviceId], (err, row) => {
      if (err) reject(err);
      else if (!row) reject(new Error('设备不存在'));
      else resolve(row.battery_level >= minBattery);
    });
  });
};

const checkDuplicateSubmission = (deviceNumber, flowType, timeWindow = 60000) => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT COUNT(*) as count 
      FROM flow_records 
      WHERE device_number = ? 
        AND flow_type = ? 
        AND created_at >= datetime('now', '-' || ? || ' milliseconds')
    `;
    db.get(query, [deviceNumber, flowType, timeWindow], (err, row) => {
      if (err) reject(err);
      else resolve(row.count > 0);
    });
  });
};

const validateRental = async (req, res, next) => {
  const { device_id, operator } = req.body;
  
  try {
    const device = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM devices WHERE id = ?', [device_id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!device) {
      return res.status(400).json({ error: '设备不存在' });
    }

    if (device.status !== 'available') {
      return res.status(400).json({ error: '设备不可用，当前状态: ' + device.status });
    }

    if (device.battery_level < 20) {
      return res.status(400).json({ error: '设备电量过低，请先充电', battery_level: device.battery_level });
    }

    const isDuplicate = await checkDuplicateSubmission(device.device_number, 'rent');
    if (isDuplicate) {
      return res.status(400).json({ error: '操作过于频繁，请稍后再试' });
    }

    req.device = device;
    next();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const validateReturn = async (req, res, next) => {
  const { order_id, battery_level, operator } = req.body;
  
  try {
    const order = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM rental_orders WHERE id = ?', [order_id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!order) {
      return res.status(400).json({ error: '订单不存在' });
    }

    if (order.status !== 'active') {
      return res.status(400).json({ error: '订单已归还或已取消' });
    }

    const device = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM devices WHERE id = ?', [order.device_id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    const isDuplicate = await checkDuplicateSubmission(device.device_number, 'return');
    if (isDuplicate) {
      return res.status(400).json({ error: '操作过于频繁，请稍后再试' });
    }

    req.order = order;
    req.device = device;
    next();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { validateRental, validateReturn, checkBatteryLevel, checkDuplicateSubmission };
