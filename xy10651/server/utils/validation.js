function validateSkillMatch(staffSkills, requiredSkills) {
  if (!requiredSkills || requiredSkills.length === 0) return true;
  if (!staffSkills) return false;
  
  const staffSkillSet = new Set(staffSkills.split(',').map(s => s.trim()));
  const requiredSkillList = requiredSkills.split(',').map(s => s.trim());
  
  return requiredSkillList.every(skill => staffSkillSet.has(skill));
}

function preventDuplicateCallback(shiftId, currentTime, callbackThreshold = 60000) {
  return new Promise((resolve, reject) => {
    const db = require('../database/db');
    db.get(
      `SELECT callback_count, last_callback_time FROM shift_changes WHERE id = ?`,
      [shiftId],
      (err, row) => {
        if (err) reject(err);
        if (!row) resolve({ allowed: true, count: 0 });
        
        const lastTime = row.last_callback_time ? new Date(row.last_callback_time).getTime() : 0;
        const timeDiff = currentTime - lastTime;
        
        if (timeDiff < callbackThreshold && row.callback_count > 0) {
          resolve({ allowed: false, count: row.callback_count });
        } else {
          resolve({ allowed: true, count: row.callback_count });
        }
      }
    );
  });
}

module.exports = { validateSkillMatch, preventDuplicateCallback };
