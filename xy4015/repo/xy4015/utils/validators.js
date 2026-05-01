const db = require('../database/db');

const validateMember = (member) => {
  const errors = [];
  
  if (!member.name || !member.name.trim()) {
    errors.push('会员姓名不能为空');
  }
  
  if (!member.phone || !member.phone.trim()) {
    errors.push('手机号码不能为空');
  } else if (!/^1[3-9]\d{9}$/.test(member.phone)) {
    errors.push('手机号码格式不正确');
  }
  
  if (member.email && member.email.trim()) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(member.email)) {
      errors.push('邮箱格式不正确');
    }
  }
  
  if (member.remaining_sessions !== undefined && member.remaining_sessions !== null) {
    if (isNaN(member.remaining_sessions) || member.remaining_sessions < 0) {
      errors.push('剩余课时必须是非负整数');
    }
  }
  
  if (member.status) {
    const validStatuses = ['active', 'frozen', 'arrears'];
    if (!validStatuses.includes(member.status)) {
      errors.push('无效的会员状态');
    }
  }
  
  return errors;
};

const validateCourse = (course) => {
  const errors = [];
  
  if (!course.name || !course.name.trim()) {
    errors.push('课程名称不能为空');
  }
  
  if (course.duration !== undefined && course.duration !== null) {
    if (isNaN(course.duration) || course.duration <= 0) {
      errors.push('课程时长必须是正整数');
    }
  }
  
  return errors;
};

const validateCoach = (coach) => {
  const errors = [];
  
  if (!coach.name || !coach.name.trim()) {
    errors.push('教练姓名不能为空');
  }
  
  return errors;
};

const validateSchedule = (schedule) => {
  const errors = [];
  
  if (!schedule.course_id) {
    errors.push('请选择课程');
  }
  
  if (!schedule.coach_id) {
    errors.push('请选择教练');
  }
  
  if (!schedule.date || !schedule.date.trim()) {
    errors.push('请选择日期');
  } else {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(schedule.date)) {
      errors.push('日期格式不正确，应为YYYY-MM-DD');
    }
  }
  
  if (!schedule.start_time || !schedule.start_time.trim()) {
    errors.push('请选择开始时间');
  } else {
    const timeRegex = /^\d{2}:\d{2}$/;
    if (!timeRegex.test(schedule.start_time)) {
      errors.push('开始时间格式不正确，应为HH:MM');
    }
  }
  
  if (!schedule.end_time || !schedule.end_time.trim()) {
    errors.push('请选择结束时间');
  } else {
    const timeRegex = /^\d{2}:\d{2}$/;
    if (!timeRegex.test(schedule.end_time)) {
      errors.push('结束时间格式不正确，应为HH:MM');
    }
  }
  
  if (schedule.start_time && schedule.end_time) {
    if (schedule.start_time >= schedule.end_time) {
      errors.push('结束时间必须晚于开始时间');
    }
  }
  
  if (schedule.capacity !== undefined && schedule.capacity !== null) {
    if (isNaN(schedule.capacity) || schedule.capacity <= 0) {
      errors.push('容量必须是正整数');
    }
  }
  
  return errors;
};

const validateBooking = (booking) => {
  return new Promise((resolve, reject) => {
    const errors = [];
    
    if (!booking.member_id) {
      errors.push('请选择会员');
      resolve(errors);
      return;
    }
    
    if (!booking.schedule_id) {
      errors.push('请选择课程安排');
      resolve(errors);
      return;
    }
    
    db.get(`SELECT * FROM members WHERE id = ?`, [booking.member_id], (err, member) => {
      if (err) {
        reject(err);
        return;
      }
      
      if (!member) {
        errors.push('会员不存在');
        resolve(errors);
        return;
      }
      
      if (member.status === 'frozen') {
        errors.push('该会员已被冻结，无法预约');
      }
      
      if (member.status === 'arrears') {
        errors.push('该会员欠费，无法预约');
      }
      
      if (member.remaining_sessions <= 0) {
        errors.push('该会员剩余课时不足');
      }
      
      db.get(`SELECT * FROM schedules WHERE id = ?`, [booking.schedule_id], (err, schedule) => {
        if (err) {
          reject(err);
          return;
        }
        
        if (!schedule) {
          errors.push('课程安排不存在');
          resolve(errors);
          return;
        }
        
        if (schedule.booked_count >= schedule.capacity) {
          errors.push('该课程已满员');
        }
        
        db.get(
          `SELECT * FROM bookings WHERE member_id = ? AND schedule_id = ? AND status = 'booked'`,
          [booking.member_id, booking.schedule_id],
          (err, existingBooking) => {
            if (err) {
              reject(err);
              return;
            }
            
            if (existingBooking) {
              errors.push('该会员已预约此课程');
            }
            
            resolve(errors);
          }
        );
      });
    });
  });
};

const canCancelBooking = (schedule, currentTime = new Date()) => {
  const scheduleDate = new Date(`${schedule.date}T${schedule.start_time}`);
  const twoHoursBefore = new Date(scheduleDate.getTime() - 2 * 60 * 60 * 1000);
  
  return {
    canCancel: currentTime <= twoHoursBefore,
    hoursBefore: (scheduleDate - currentTime) / (1000 * 60 * 60)
  };
};

module.exports = {
  validateMember,
  validateCourse,
  validateCoach,
  validateSchedule,
  validateBooking,
  canCancelBooking
};
