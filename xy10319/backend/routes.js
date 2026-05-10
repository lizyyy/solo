const express = require('express');
const dayjs = require('dayjs');
const { db } = require('./database');

const router = express.Router();

const getDatabase = () => db.getData();

const getBookingDetail = (bookingId) => {
  const data = getDatabase();
  const booking = data.trial_bookings.find(b => b.id === Number(bookingId));
  
  if (!booking) return null;

  const customer = data.customers.find(c => c.id === booking.customer_id);
  const consultant = data.consultants.find(c => c.id === booking.consultant_id);
  const course = data.courses.find(c => c.id === booking.course_id);
  const attendance = data.attendances.find(a => a.booking_id === booking.id);
  const feedback = data.parent_feedbacks.find(f => f.booking_id === booking.id);
  const enrollment = data.enrollments.find(e => e.booking_id === booking.id);

  const followUps = data.follow_ups
    .filter(f => f.booking_id === booking.id)
    .map(f => ({
      ...f,
      consultant_name: data.consultants.find(c => c.id === f.consultant_id)?.name || '未知'
    }))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const lostLeads = data.lost_leads
    .filter(l => l.booking_id === booking.id)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return {
    ...booking,
    child_name: customer?.child_name,
    child_age: customer?.child_age,
    parent_name: customer?.parent_name || null,
    phone: customer?.phone || null,
    consultant_name: consultant?.name,
    department: consultant?.department || '',
    course_name: course?.name,
    age_range: course?.age_range || '',
    check_in_time: attendance?.check_in_time || null,
    attendance_notes: attendance?.notes || null,
    satisfaction: feedback?.satisfaction || null,
    feedback_text: feedback?.feedback_text || null,
    enrollment_id: enrollment?.id || null,
    promotion_id: enrollment?.promotion_id || null,
    enrollment_date: enrollment?.enrollment_date || null,
    amount: enrollment?.amount || null,
    enrollment_notes: enrollment?.notes || null,
    follow_ups: followUps,
    lost_history: lostLeads
  };
};

router.get('/consultants', (req, res) => {
  const data = getDatabase();
  res.json([...data.consultants].sort((a, b) => a.name.localeCompare(b.name)));
});

router.get('/courses', (req, res) => {
  const data = getDatabase();
  res.json([...data.courses].sort((a, b) => a.name.localeCompare(b.name)));
});

router.get('/promotions', (req, res) => {
  const data = getDatabase();
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  
  const promotions = data.promotions.map(p => {
    const isAvailable = 
      p.status === 'active' &&
      new Date(p.expire_date) >= new Date(now) &&
      p.used_count < p.max_count;
    
    return {
      ...p,
      is_available: isAvailable ? 1 : 0
    };
  });
  
  res.json(promotions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
});

router.get('/bookings', (req, res) => {
  const { consultant_id, course_id, status } = req.query;
  const data = getDatabase();
  
  let bookings = data.trial_bookings.map(booking => {
    const customer = data.customers.find(c => c.id === booking.customer_id);
    const consultant = data.consultants.find(c => c.id === booking.consultant_id);
    const course = data.courses.find(c => c.id === booking.course_id);
    const attendance = data.attendances.find(a => a.booking_id === booking.id);
    
    return {
      ...booking,
      child_name: customer?.child_name,
      child_age: customer?.child_age,
      consultant_name: consultant?.name,
      course_name: course?.name,
      check_in_time: attendance?.check_in_time || null
    };
  });
  
  if (consultant_id) {
    bookings = bookings.filter(b => b.consultant_id === Number(consultant_id));
  }
  
  if (course_id) {
    bookings = bookings.filter(b => b.course_id === Number(course_id));
  }
  
  if (status) {
    bookings = bookings.filter(b => b.status === status);
  }
  
  bookings.sort((a, b) => new Date(b.booking_date) - new Date(a.booking_date));
  
  res.json(bookings);
});

router.get('/bookings/:id', (req, res) => {
  const detail = getBookingDetail(req.params.id);
  if (!detail) {
    return res.status(404).json({ error: '预约记录不存在' });
  }
  res.json(detail);
});

router.post('/bookings', (req, res) => {
  const { child_name, child_age, parent_name, phone, course_id, consultant_id, booking_date, notes } = req.body;
  
  if (!child_name || !child_age || !course_id || !consultant_id || !booking_date) {
    return res.status(400).json({ error: '缺少必要字段' });
  }

  const data = getDatabase();
  
  const newCustomer = {
    id: data.customers.length > 0 ? Math.max(...data.customers.map(c => c.id)) + 1 : 1,
    child_name,
    child_age: Number(child_age),
    parent_name: parent_name || null,
    phone: phone || null,
    status: 'active',
    created_at: dayjs().format('YYYY-MM-DD HH:mm:ss')
  };
  data.customers.push(newCustomer);
  
  const newBooking = {
    id: data.trial_bookings.length > 0 ? Math.max(...data.trial_bookings.map(b => b.id)) + 1 : 1,
    customer_id: newCustomer.id,
    course_id: Number(course_id),
    consultant_id: Number(consultant_id),
    booking_date: booking_date.replace('T', ' ') + ':00',
    status: 'booked',
    notes: notes || null,
    created_at: dayjs().format('YYYY-MM-DD HH:mm:ss')
  };
  data.trial_bookings.push(newBooking);
  
  db.transaction(() => {});
  
  res.status(201).json({ id: newBooking.id, message: '预约创建成功' });
});

router.put('/bookings/:id/checkin', (req, res) => {
  const bookingId = Number(req.params.id);
  const data = getDatabase();
  const booking = data.trial_bookings.find(b => b.id === bookingId);
  
  if (!booking) {
    return res.status(404).json({ error: '预约记录不存在' });
  }
  
  if (booking.status === 'enrolled' || booking.status === 'lost') {
    return res.status(400).json({ error: '当前状态不允许签到' });
  }

  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  
  let attendance = data.attendances.find(a => a.booking_id === bookingId);
  
  if (attendance) {
    attendance.check_in_time = now;
    attendance.notes = req.body.notes || '签到成功';
  } else {
    const newAttendance = {
      id: data.attendances.length > 0 ? Math.max(...data.attendances.map(a => a.id)) + 1 : 1,
      booking_id: bookingId,
      check_in_time: now,
      notes: req.body.notes || '签到成功',
      created_at: now
    };
    data.attendances.push(newAttendance);
  }
  
  booking.status = 'following';
  
  db.transaction(() => {});
  
  res.json({ message: '签到成功' });
});

router.put('/bookings/:id/noshow', (req, res) => {
  const bookingId = Number(req.params.id);
  const data = getDatabase();
  const booking = data.trial_bookings.find(b => b.id === bookingId);
  
  if (!booking) {
    return res.status(404).json({ error: '预约记录不存在' });
  }
  
  if (booking.status === 'enrolled' || booking.status === 'lost') {
    return res.status(400).json({ error: '当前状态不允许标记未到课' });
  }

  booking.status = 'no_show';
  
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const newAttendance = {
    id: data.attendances.length > 0 ? Math.max(...data.attendances.map(a => a.id)) + 1 : 1,
    booking_id: bookingId,
    check_in_time: null,
    notes: req.body.reason || '未到课',
    created_at: now
  };
  data.attendances.push(newAttendance);
  
  db.transaction(() => {});
  
  res.json({ message: '已标记为未到课' });
});

router.put('/bookings/:id/feedback', (req, res) => {
  const bookingId = Number(req.params.id);
  const { satisfaction, feedback_text } = req.body;
  const data = getDatabase();
  
  const booking = data.trial_bookings.find(b => b.id === bookingId);
  
  if (!booking) {
    return res.status(404).json({ error: '预约记录不存在' });
  }

  let feedback = data.parent_feedbacks.find(f => f.booking_id === bookingId);
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  
  if (feedback) {
    feedback.satisfaction = satisfaction;
    feedback.feedback_text = feedback_text;
  } else {
    const newFeedback = {
      id: data.parent_feedbacks.length > 0 ? Math.max(...data.parent_feedbacks.map(f => f.id)) + 1 : 1,
      booking_id: bookingId,
      satisfaction,
      feedback_text,
      created_at: now
    };
    data.parent_feedbacks.push(newFeedback);
  }
  
  db.transaction(() => {});
  
  res.json({ message: '反馈已保存' });
});

router.post('/bookings/:id/followup', (req, res) => {
  const bookingId = Number(req.params.id);
  const { consultant_id, follow_up_type, content, next_follow_up_date } = req.body;
  
  if (!consultant_id || !follow_up_type || !content) {
    return res.status(400).json({ error: '缺少必要字段' });
  }

  const data = getDatabase();
  const booking = data.trial_bookings.find(b => b.id === bookingId);
  
  if (!booking) {
    return res.status(404).json({ error: '预约记录不存在' });
  }

  if (booking.status === 'enrolled') {
    return res.status(400).json({ error: '已完成报名的预约无需跟进' });
  }

  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const newFollowUp = {
    id: data.follow_ups.length > 0 ? Math.max(...data.follow_ups.map(f => f.id)) + 1 : 1,
    booking_id: bookingId,
    consultant_id: Number(consultant_id),
    follow_up_type,
    content,
    next_follow_up_date: next_follow_up_date || null,
    created_at: now
  };
  data.follow_ups.push(newFollowUp);

  if (booking.status === 'booked') {
    booking.status = 'following';
  }
  
  db.transaction(() => {});
  
  res.status(201).json({ message: '跟进记录已创建' });
});

router.put('/bookings/:id/enroll', (req, res) => {
  const bookingId = Number(req.params.id);
  const { promotion_id, amount, notes } = req.body;
  const data = getDatabase();

  const booking = data.trial_bookings.find(b => b.id === bookingId);
  
  if (!booking) {
    return res.status(404).json({ error: '预约记录不存在' });
  }

  if (booking.status === 'enrolled') {
    return res.status(400).json({ error: '该预约已经完成报名' });
  }

  if (booking.status === 'no_show') {
    return res.status(400).json({ error: '未到课的预约不能转正式报名' });
  }

  if (booking.status === 'lost') {
    return res.status(400).json({ error: '已流失的预约需要先重新激活才能报名' });
  }

  const attendance = data.attendances.find(a => a.booking_id === bookingId && a.check_in_time !== null);
  
  if (!attendance) {
    return res.status(400).json({ error: '未到课的预约不能转正式报名，请先完成签到' });
  }

  let selectedPromotion = null;
  if (promotion_id) {
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
    selectedPromotion = data.promotions.find(p => 
      p.id === Number(promotion_id) &&
      p.status === 'active' &&
      new Date(p.expire_date) >= new Date(now) &&
      p.used_count < p.max_count
    );
    
    if (!selectedPromotion) {
      return res.status(400).json({ error: '优惠名额不可用（已过期、已用完或不存在）' });
    }
  }

  const existingEnrollment = data.enrollments.find(e => 
    e.promotion_id === (promotion_id ? Number(promotion_id) : null) && 
    e.booking_id !== bookingId
  );
  
  if (existingEnrollment) {
    return res.status(400).json({ error: '该优惠名额已被其他预约锁定' });
  }

  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  
  if (selectedPromotion) {
    selectedPromotion.used_count += 1;
  }

  const newEnrollment = {
    id: data.enrollments.length > 0 ? Math.max(...data.enrollments.map(e => e.id)) + 1 : 1,
    booking_id: bookingId,
    promotion_id: promotion_id ? Number(promotion_id) : null,
    enrollment_date: now,
    amount: amount ? Number(amount) : 0,
    notes: notes || null,
    created_at: now
  };
  data.enrollments.push(newEnrollment);

  booking.status = 'enrolled';
  
  db.transaction(() => {});
  
  res.json({ message: '报名成功' });
});

router.put('/bookings/:id/lost', (req, res) => {
  const bookingId = Number(req.params.id);
  const { lost_reason } = req.body;
  const data = getDatabase();

  const booking = data.trial_bookings.find(b => b.id === bookingId);
  
  if (!booking) {
    return res.status(404).json({ error: '预约记录不存在' });
  }

  if (booking.status === 'enrolled') {
    return res.status(400).json({ error: '已完成报名的预约不能标记为流失' });
  }

  if (booking.status === 'lost') {
    return res.status(400).json({ error: '该预约已经是流失状态' });
  }

  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  booking.status = 'lost';

  const newLostLead = {
    id: data.lost_leads.length > 0 ? Math.max(...data.lost_leads.map(l => l.id)) + 1 : 1,
    booking_id: bookingId,
    lost_reason: lost_reason || '未填写原因',
    lost_date: now,
    reactivated_at: null,
    created_at: now
  };
  data.lost_leads.push(newLostLead);

  const customer = data.customers.find(c => c.id === booking.customer_id);
  if (customer) {
    customer.status = 'lost';
  }
  
  db.transaction(() => {});
  
  res.json({ message: '已标记为流失线索' });
});

router.put('/bookings/:id/reactivate', (req, res) => {
  const bookingId = Number(req.params.id);
  const { new_booking_date, new_consultant_id, new_course_id } = req.body;
  const data = getDatabase();

  const booking = data.trial_bookings.find(b => b.id === bookingId);
  
  if (!booking) {
    return res.status(404).json({ error: '预约记录不存在' });
  }

  if (booking.status !== 'lost') {
    return res.status(400).json({ error: '只有流失状态的预约才能重新激活' });
  }

  const lostLead = [...data.lost_leads]
    .filter(l => l.booking_id === bookingId)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];

  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  
  if (lostLead) {
    lostLead.reactivated_at = now;
  }

  booking.status = 'following';
  
  if (new_booking_date) {
    booking.booking_date = new_booking_date.replace('T', ' ') + ':00';
  }
  if (new_consultant_id) {
    booking.consultant_id = Number(new_consultant_id);
  }
  if (new_course_id) {
    booking.course_id = Number(new_course_id);
  }

  const customer = data.customers.find(c => c.id === booking.customer_id);
  if (customer) {
    customer.status = 'active';
  }
  
  db.transaction(() => {});
  
  res.json({ message: '线索已重新激活', has_lost_history: !!lostLead });
});

router.get('/statistics', (req, res) => {
  const data = getDatabase();
  
  const totalBookings = data.trial_bookings.length;
  const enrolledCount = data.trial_bookings.filter(b => b.status === 'enrolled').length;
  const noShowCount = data.trial_bookings.filter(b => b.status === 'no_show').length;
  const lostCount = data.trial_bookings.filter(b => b.status === 'lost').length;
  const followingCount = data.trial_bookings.filter(b => b.status === 'following').length;
  const reactivatedCount = data.lost_leads.filter(l => l.reactivated_at !== null).length;
  
  const conversionRate = totalBookings > 0 ? ((enrolledCount / totalBookings) * 100).toFixed(1) : 0;

  const consultantStats = data.consultants.map(consultant => {
    const consultantBookings = data.trial_bookings.filter(b => b.consultant_id === consultant.id);
    const enrolledConsultant = consultantBookings.filter(b => b.status === 'enrolled').length;
    const lostConsultant = consultantBookings.filter(b => b.status === 'lost').length;
    const noShowConsultant = consultantBookings.filter(b => b.status === 'no_show').length;
    const followUpCount = data.follow_ups.filter(f => f.consultant_id === consultant.id).length;
    
    const feedbacks = data.parent_feedbacks.filter(f => 
      consultantBookings.some(b => b.id === f.booking_id) && f.satisfaction
    );
    const avgSatisfaction = feedbacks.length > 0 
      ? feedbacks.reduce((sum, f) => sum + f.satisfaction, 0) / feedbacks.length 
      : null;
    
    return {
      id: consultant.id,
      name: consultant.name,
      department: consultant.department,
      total_bookings: consultantBookings.length,
      enrolled_count: enrolledConsultant,
      lost_count: lostConsultant,
      no_show_count: noShowConsultant,
      follow_up_count: followUpCount,
      avg_satisfaction: avgSatisfaction
    };
  });

  consultantStats.sort((a, b) => {
    if (b.enrolled_count !== a.enrolled_count) return b.enrolled_count - a.enrolled_count;
    return b.total_bookings - a.total_bookings;
  });

  const courseStats = data.courses.map(course => {
    const courseBookings = data.trial_bookings.filter(b => b.course_id === course.id);
    const enrolledCourse = courseBookings.filter(b => b.status === 'enrolled').length;
    
    return {
      id: course.id,
      name: course.name,
      age_range: course.age_range,
      total_bookings: courseBookings.length,
      enrolled_count: enrolledCourse
    };
  });

  courseStats.sort((a, b) => b.total_bookings - a.total_bookings);

  res.json({
    overview: {
      total_bookings: totalBookings,
      enrolled_count: enrolledCount,
      no_show_count: noShowCount,
      lost_count: lostCount,
      following_count: followingCount,
      reactivated_count: reactivatedCount,
      conversion_rate: parseFloat(conversionRate)
    },
    consultant_stats: consultantStats,
    course_stats: courseStats
  });
});

router.get('/export', (req, res) => {
  const data = getDatabase();
  
  const bookings = data.trial_bookings.map(booking => {
    const customer = data.customers.find(c => c.id === booking.customer_id);
    const consultant = data.consultants.find(c => c.id === booking.consultant_id);
    const course = data.courses.find(c => c.id === booking.course_id);
    const attendance = data.attendances.find(a => a.booking_id === booking.id);
    const feedback = data.parent_feedbacks.find(f => f.booking_id === booking.id);
    const enrollment = data.enrollments.find(e => e.booking_id === booking.id);
    const promotion = enrollment?.promotion_id ? data.promotions.find(p => p.id === enrollment.promotion_id) : null;
    const lostLead = data.lost_leads.find(l => l.booking_id === booking.id);
    
    return {
      id: booking.id,
      child_name: customer?.child_name || '',
      child_age: customer?.child_age || '',
      parent_name: customer?.parent_name || '',
      phone: customer?.phone || '',
      consultant_name: consultant?.name || '',
      department: consultant?.department || '',
      course_name: course?.name || '',
      booking_date: booking.booking_date,
      status: booking.status,
      check_in_time: attendance?.check_in_time || '',
      satisfaction: feedback?.satisfaction || '',
      enrollment_date: enrollment?.enrollment_date || '',
      amount: enrollment?.amount || '',
      promotion_name: promotion?.name || '',
      lost_reason: lostLead?.lost_reason || '',
      reactivated_at: lostLead?.reactivated_at || ''
    };
  });

  const statusMap = {
    'booked': '已预约',
    'following': '跟进中',
    'enrolled': '已报名',
    'no_show': '未到课',
    'lost': '已流失'
  };

  const csvHeaders = [
    '预约ID', '孩子姓名', '年龄', '家长姓名', '联系电话',
    '顾问', '部门', '课程', '预约时间', '状态',
    '签到时间', '满意度', '报名时间', '报名金额',
    '使用优惠', '流失原因', '重新激活时间'
  ];

  const csvRows = bookings.map(b => [
    b.id, b.child_name, b.child_age, b.parent_name, b.phone,
    b.consultant_name, b.department, b.course_name, b.booking_date,
    statusMap[b.status] || b.status,
    b.check_in_time, b.satisfaction,
    b.enrollment_date, b.amount,
    b.promotion_name, b.lost_reason,
    b.reactivated_at
  ]);

  const csvContent = [
    csvHeaders.join(','),
    ...csvRows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=conversion_export_${dayjs().format('YYYYMMDD')}.csv`);
  res.send('\uFEFF' + csvContent);
});

module.exports = router;
