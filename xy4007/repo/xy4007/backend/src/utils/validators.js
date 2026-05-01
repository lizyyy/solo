const db = require('../database/db');

const validatePhone = (phone) => {
  if (!phone) return { valid: false, message: '手机号不能为空' };
  const phoneRegex = /^1[3-9]\d{9}$/;
  if (!phoneRegex.test(phone)) {
    return { valid: false, message: '手机号格式不正确' };
  }
  return { valid: true };
};

const validateEstimatedTime = (createdAt, estimatedCompletionTime) => {
  if (!estimatedCompletionTime) return { valid: true };
  
  const created = new Date(createdAt);
  const estimated = new Date(estimatedCompletionTime);
  
  if (estimated <= created) {
    return { valid: false, message: '预计完成时间不能早于接单时间' };
  }
  return { valid: true };
};

const checkTechnicianConflict = (technicianId, estimatedCompletionTime, excludeOrderId = null) => {
  return new Promise((resolve, reject) => {
    if (!technicianId || !estimatedCompletionTime) {
      resolve({ conflict: false });
      return;
    }

    const estimatedDate = new Date(estimatedCompletionTime).toISOString().split('T')[0];
    
    let query = `
      SELECT o.id, o.estimated_completion_time, t.name as technician_name
      FROM orders o
      JOIN technicians t ON o.technician_id = t.id
      WHERE o.technician_id = ? 
      AND DATE(o.estimated_completion_time) = ?
      AND o.status NOT IN ('已完成', '已取消')
    `;
    
    const params = [technicianId, estimatedDate];
    
    if (excludeOrderId) {
      query += ' AND o.id != ?';
      params.push(excludeOrderId);
    }

    db.get(query, params, (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      
      if (row) {
        resolve({
          conflict: true,
          message: `该时段（${estimatedDate}）${row.technician_name}已有预约`
        });
      } else {
        resolve({ conflict: false });
      }
    });
  });
};

module.exports = {
  validatePhone,
  validateEstimatedTime,
  checkTechnicianConflict
};
