const validateWorkOrder = (row, rowNumber) => {
  const errors = [];
  const suggestions = [];

  if (!row.order_no || row.order_no.trim() === '') {
    errors.push('缺少作业单号');
    suggestions.push(`建议作业单号: WO${Date.now()}${rowNumber}`);
  }

  if (!row.machine_no || row.machine_no.trim() === '') {
    errors.push('缺少拖拉机编号');
    suggestions.push('请填写机手手写单上的拖拉机编号，如: T-001');
  }

  if (!row.operator_name || row.operator_name.trim() === '') {
    errors.push('缺少机手姓名');
    suggestions.push('请补全机手姓名信息');
  }

  if (!row.work_date || row.work_date.trim() === '') {
    errors.push('缺少作业日期');
    suggestions.push('日期格式建议: YYYY-MM-DD');
  } else {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(row.work_date)) {
      errors.push('作业日期格式错误');
      suggestions.push('请使用 YYYY-MM-DD 格式，如: 2024-05-20');
    }
  }

  if (!row.work_type || row.work_type.trim() === '') {
    errors.push('缺少作业类型');
    suggestions.push('常见作业类型: 耕地、播种、收割、运输');
  }

  const hours = parseFloat(row.hours);
  const acres = parseFloat(row.acres);
  const fuel_cost = parseFloat(row.fuel_cost);

  if ((isNaN(hours) || hours <= 0) && (isNaN(acres) || acres <= 0) && (isNaN(fuel_cost) || fuel_cost <= 0)) {
    errors.push('至少需要填写作业小时数、作业亩数或油费其中一项');
    suggestions.push('请补全计费相关数据（小时、亩数、油费至少一项）');
  }

  if (row.hours && isNaN(hours)) {
    errors.push('作业小时数格式错误');
    suggestions.push('请填写数字，如: 8.5');
  }

  if (row.acres && isNaN(acres)) {
    errors.push('作业亩数格式错误');
    suggestions.push('请填写数字，如: 50.0');
  }

  if (row.fuel_cost && isNaN(fuel_cost)) {
    errors.push('油费格式错误');
    suggestions.push('请填写数字，如: 200.50');
  }

  return {
    isValid: errors.length === 0,
    errors,
    suggestions,
    cleanedData: {
      order_no: row.order_no ? row.order_no.trim() : null,
      machine_no: row.machine_no ? row.machine_no.trim() : null,
      operator_name: row.operator_name ? row.operator_name.trim() : null,
      work_date: row.work_date ? row.work_date.trim() : null,
      work_type: row.work_type ? row.work_type.trim() : null,
      hours: !isNaN(hours) ? hours : null,
      acres: !isNaN(acres) ? acres : null,
      fuel_cost: !isNaN(fuel_cost) ? fuel_cost : null,
      total_amount: null
    }
  };
};

const validateFuelRecord = (record, rowNumber) => {
  const errors = [];
  const suggestions = [];

  if (!record.record_no || record.record_no.trim() === '') {
    errors.push('缺少加油记录单号');
    suggestions.push(`建议记录单号: FUEL${Date.now()}${rowNumber}`);
  }

  if (!record.machine_no || record.machine_no.trim() === '') {
    errors.push('缺少拖拉机编号');
    suggestions.push('请填写拖拉机编号，如: T-001');
  }

  if (!record.fuel_date || record.fuel_date.trim() === '') {
    errors.push('缺少加油日期');
    suggestions.push('日期格式建议: YYYY-MM-DD');
  }

  if (!record.fuel_type || record.fuel_type.trim() === '') {
    errors.push('缺少油品类型');
    suggestions.push('常见油品: 柴油、汽油');
  }

  const liters = parseFloat(record.liters);
  const price_per_liter = parseFloat(record.price_per_liter);

  if (isNaN(liters) || liters <= 0) {
    errors.push('加油升数无效');
    suggestions.push('请填写正数，如: 50.0');
  }

  if (isNaN(price_per_liter) || price_per_liter <= 0) {
    errors.push('单价无效');
    suggestions.push('请填写正数，如: 7.50');
  }

  return {
    isValid: errors.length === 0,
    errors,
    suggestions,
    cleanedData: {
      record_no: record.record_no ? record.record_no.trim() : null,
      machine_no: record.machine_no ? record.machine_no.trim() : null,
      fuel_date: record.fuel_date ? record.fuel_date.trim() : null,
      fuel_type: record.fuel_type ? record.fuel_type.trim() : null,
      liters: !isNaN(liters) ? liters : null,
      price_per_liter: !isNaN(price_per_liter) ? price_per_liter : null,
      total_cost: !isNaN(liters) && !isNaN(price_per_liter) ? liters * price_per_liter : null
    }
  };
};

const validateRateConfig = (config, rowNumber) => {
  const errors = [];
  const suggestions = [];

  if (!config.work_type || config.work_type.trim() === '') {
    errors.push('缺少作业类型');
    suggestions.push('常见作业类型: 耕地、播种、收割、运输');
  }

  const rate_per_hour = parseFloat(config.rate_per_hour);
  const rate_per_acre = parseFloat(config.rate_per_acre);

  if (isNaN(rate_per_hour) && isNaN(rate_per_acre)) {
    errors.push('至少需要设置小时费率或亩数费率');
    suggestions.push('请设置小时费率或亩数费率');
  }

  if (config.rate_per_hour && isNaN(rate_per_hour)) {
    errors.push('小时费率格式错误');
    suggestions.push('请填写数字，如: 150.00');
  }

  if (config.rate_per_acre && isNaN(rate_per_acre)) {
    errors.push('亩数费率格式错误');
    suggestions.push('请填写数字，如: 50.00');
  }

  return {
    isValid: errors.length === 0,
    errors,
    suggestions,
    cleanedData: {
      work_type: config.work_type ? config.work_type.trim() : null,
      rate_per_hour: !isNaN(rate_per_hour) ? rate_per_hour : null,
      rate_per_acre: !isNaN(rate_per_acre) ? rate_per_acre : null,
      fuel_surcharge_rate: config.fuel_surcharge_rate ? parseFloat(config.fuel_surcharge_rate) : 0,
      effective_date: config.effective_date || new Date().toISOString().split('T')[0]
    }
  };
};

module.exports = {
  validateWorkOrder,
  validateFuelRecord,
  validateRateConfig
};