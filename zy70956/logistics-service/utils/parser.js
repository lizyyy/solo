const { parse } = require('csv-parse/sync');

function parseRepairCSV(text) {
  const rows = parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  return rows.map((row, idx) => ({
    row: idx + 2,
    data: {
      requestId: row['报修单号'] || row['requestId'] || '',
      building: row['宿舍楼栋'] || row['building'] || '',
      room: row['房间号'] || row['room'] || '',
      repairType: row['报修类型'] || row['repairType'] || '',
      description: row['报修内容'] || row['description'] || '',
      reporter: row['报修人'] || row['reporter'] || '',
      reporterPhone: row['联系电话'] || row['reporterPhone'] || '',
      reportedAt: row['报修时间'] || row['reportedAt'] || new Date().toISOString()
    }
  }));
}

function parseRatingCSV(text) {
  const rows = parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  return rows.map((row, idx) => ({
    row: idx + 2,
    data: {
      ratingId: row['评分单号'] || row['ratingId'] || '',
      requestId: row['报修单号'] || row['requestId'] || '',
      workerId: row['维修工号'] || row['workerId'] || '',
      score: parseInt(row['评分'] || row['score'] || '0', 10),
      comment: row['评价'] || row['comment'] || '',
      ratedBy: row['评分人'] || row['ratedBy'] || '',
      ratedAt: row['评分时间'] || row['ratedAt'] || new Date().toISOString()
    }
  }));
}

function parseWorkerJSON(text) {
  let arr;
  try {
    arr = JSON.parse(text);
  } catch (e) {
    throw new Error('维修工 JSON 格式错误: ' + e.message);
  }
  if (!Array.isArray(arr)) {
    throw new Error('维修工 JSON 必须是数组格式');
  }
  return arr.map((item, idx) => ({
    row: idx + 1,
    data: {
      workerId: item.workerId || item.工号 || '',
      name: item.name || item.姓名 || '',
      trade: item.trade || item.工种 || '',
      phone: item.phone || item.电话 || '',
      team: item.team || item.班组 || '',
      status: item.status || item.状态 || '在岗'
    }
  }));
}

function validateRepairRecord(rec) {
  const errors = [];
  if (!rec.requestId) errors.push('报修单号不能为空');
  if (!rec.building) errors.push('宿舍楼栋不能为空');
  if (!rec.room) errors.push('房间号不能为空');
  if (!rec.repairType) errors.push('报修类型不能为空');
  if (!rec.description) errors.push('报修内容不能为空');
  if (!rec.reporter) errors.push('报修人不能为空');
  return errors;
}

function validateWorkerRecord(rec) {
  const errors = [];
  if (!rec.workerId) errors.push('工号不能为空');
  if (!rec.name) errors.push('姓名不能为空');
  if (!rec.trade) errors.push('工种不能为空');
  const validTrades = ['水电', '土木', '暖通', '电子', '综合'];
  if (rec.trade && !validTrades.includes(rec.trade)) {
    errors.push(`工种必须是 ${validTrades.join('/')} 之一`);
  }
  return errors;
}

function validateRatingRecord(rec) {
  const errors = [];
  if (!rec.ratingId) errors.push('评分单号不能为空');
  if (!rec.requestId) errors.push('报修单号不能为空');
  if (!rec.workerId) errors.push('维修工号不能为空');
  if (!rec.score || rec.score < 1 || rec.score > 5) errors.push('评分必须是 1-5 的整数');
  if (!rec.ratedBy) errors.push('评分人不能为空');
  return errors;
}

module.exports = {
  parseRepairCSV,
  parseRatingCSV,
  parseWorkerJSON,
  validateRepairRecord,
  validateWorkerRecord,
  validateRatingRecord
};
