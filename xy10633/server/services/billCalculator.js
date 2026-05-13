const db = require('../database/db');
const moment = require('moment');

const getPrices = () => {
  return new Promise((resolve, reject) => {
    db.all('SELECT type, price FROM price_settings', (err, rows) => {
      if (err) reject(err);
      else {
        const prices = {};
        rows.forEach(r => prices[r.type] = r.price);
        resolve(prices);
      }
    });
  });
};

const getContractMeterReading = (contractId, billMonth) => {
  return new Promise((resolve, reject) => {
    const startDate = moment(billMonth).startOf('month').format('YYYY-MM-DD');
    const endDate = moment(billMonth).endOf('month').format('YYYY-MM-DD');
    db.get(`SELECT * FROM meter_readings 
            WHERE contract_id = ? AND reading_date BETWEEN ? AND ?
            ORDER BY reading_date DESC LIMIT 1`, 
      [contractId, startDate, endDate], (err, row) => {
        if (err) reject(err);
        else resolve(row || { water_usage: 0, electric_usage: 0 });
      });
  });
};

const getContractDevices = (contractId) => {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM special_devices WHERE contract_id = ? AND status = 'active'`, 
      [contractId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
  });
};

const calculateDeviceAmount = (devices, electricPrice) => {
  let totalAmount = 0;
  devices.forEach(device => {
    if (device.fixed_usage) {
      totalAmount += device.fixed_usage * electricPrice;
    } else if (device.power && device.hours_per_day && device.days_per_month) {
      const kwh = (device.power / 1000) * device.hours_per_day * device.days_per_month;
      totalAmount += kwh * electricPrice;
    }
  });
  return totalAmount;
};

const checkExceptions = (contract, billMonth, waterUsage, electricUsage) => {
  const exceptions = [];
  
  if (contract.end_date) {
    const contractEnd = moment(contract.end_date);
    const monthEnd = moment(billMonth).endOf('month');
    if (contractEnd.isBefore(monthEnd) && contractEnd.isSameOrAfter(moment(billMonth).startOf('month'))) {
      exceptions.push({
        type: 'early_termination',
        desc: `租户于${contractEnd.format('YYYY-MM-DD')}提前退租，需按天计算费用`
      });
    }
  }

  if (waterUsage > 200) {
    exceptions.push({
      type: 'abnormal_water',
      desc: `用水量异常偏高: ${waterUsage}吨`
    });
  }

  if (electricUsage > 5000) {
    exceptions.push({
      type: 'abnormal_electric',
      desc: `用电量异常偏高: ${electricUsage}度`
    });
  }

  return exceptions;
};

const calculateBill = async (contractId, billMonth) => {
  try {
    const prices = await getPrices();
    const contract = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM contracts WHERE id = ?', [contractId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!contract) throw new Error('合同不存在');

    const meterReading = await getContractMeterReading(contractId, billMonth);
    const devices = await getContractDevices(contractId);

    let waterUsage = meterReading.water_usage * contract.share_ratio;
    let electricUsage = meterReading.electric_usage * contract.share_ratio;
    const deviceAmount = calculateDeviceAmount(devices, prices.electric);

    let waterAmount = waterUsage * prices.water;
    let electricAmount = electricUsage * prices.electric;

    const exceptions = checkExceptions(contract, billMonth, waterUsage, electricUsage);
    const hasException = exceptions.length > 0;

    if (hasException && exceptions[0].type === 'early_termination' && contract.end_date) {
      const contractEnd = moment(contract.end_date);
      const monthStart = moment(billMonth).startOf('month');
      const daysInMonth = moment(billMonth).daysInMonth();
      const actualDays = contractEnd.diff(monthStart, 'days') + 1;
      const ratio = actualDays / daysInMonth;
      
      waterAmount *= ratio;
      electricAmount *= ratio;
      waterUsage *= ratio;
      electricUsage *= ratio;
    }

    const totalAmount = waterAmount + electricAmount + deviceAmount;

    return {
      contract_id: contractId,
      bill_month: billMonth,
      water_usage: Math.round(waterUsage * 100) / 100,
      water_amount: Math.round(waterAmount * 100) / 100,
      electric_usage: Math.round(electricUsage * 100) / 100,
      electric_amount: Math.round(electricAmount * 100) / 100,
      device_amount: Math.round(deviceAmount * 100) / 100,
      total_amount: Math.round(totalAmount * 100) / 100,
      unpaid_amount: Math.round(totalAmount * 100) / 100,
      has_exception: hasException ? 1 : 0,
      exception_type: hasException ? exceptions[0].type : null,
      exception_desc: hasException ? exceptions.map(e => e.desc).join('; ') : null
    };
  } catch (error) {
    throw error;
  }
};

module.exports = {
  calculateBill,
  getPrices
};
