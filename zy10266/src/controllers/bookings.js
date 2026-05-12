const storage = require('../storage');
const { Booking, BOOKING_STATUS, Student } = require('../models');

function getBookings(req, res) {
  const bookings = storage.getBookings();
  res.json({ success: true, data: bookings });
}

function getBookingById(req, res) {
  const booking = storage.getBookingById(req.params.id);
  if (!booking) {
    return res.status(404).json({ success: false, error: '预约不存在' });
  }
  res.json({ success: true, data: booking });
}

function createBooking(req, res) {
  const { roomId, bookerId, startTime, endTime, purpose, memberIds = [] } = req.body;

  if (!roomId || !bookerId || !startTime || !endTime) {
    return res.status(400).json({ 
      success: false, 
      error: '缺少必要参数: roomId, bookerId, startTime, endTime' 
    });
  }

  const room = storage.getRoomById(roomId);
  if (!room) {
    return res.status(404).json({ success: false, error: '房间不存在' });
  }

  const booker = storage.getStudentById(bookerId);
  if (!booker) {
    return res.status(404).json({ success: false, error: '预约人不存在' });
  }

  const bookerInstance = Object.assign(new Student(), booker);
  if (!bookerInstance.isAllowedToBook()) {
    return res.status(403).json({ 
      success: false, 
      error: bookerInstance.isBlacklisted 
        ? '您已被列入黑名单，暂时无法预约' 
        : '您的信誉分不足，暂时无法预约' 
    });
  }

  const start = new Date(startTime);
  const end = new Date(endTime);
  
  if (start >= end) {
    return res.status(400).json({ success: false, error: '结束时间必须晚于开始时间' });
  }

  if (start < new Date()) {
    return res.status(400).json({ success: false, error: '不能预约过去的时间' });
  }

  if (storage.hasOverlappingBooking(roomId, startTime, endTime)) {
    return res.status(409).json({ success: false, error: '该时间段已被预约' });
  }

  const allMemberIds = [bookerId, ...memberIds];
  const uniqueMemberIds = [...new Set(allMemberIds)];
  
  for (const memberId of uniqueMemberIds) {
    const member = storage.getStudentById(memberId);
    if (!member) {
      return res.status(404).json({ success: false, error: `成员 ${memberId} 不存在` });
    }
    const memberInstance = Object.assign(new Student(), member);
    if (!memberInstance.isAllowedToBook()) {
      return res.status(403).json({ 
        success: false, 
        error: `学生 ${member.name} 已被列入黑名单或信誉分不足，无法参与预约` 
      });
    }
  }

  const booking = new Booking(null, roomId, bookerId, startTime, endTime, purpose);
  uniqueMemberIds.forEach(id => booking.addMember(id));

  if (booking.hasEnoughMembers()) {
    booking.status = BOOKING_STATUS.CONFIRMED;
  }

  storage.addBooking(booking);

  res.status(201).json({ 
    success: true, 
    data: booking,
    message: booking.status === BOOKING_STATUS.CONFIRMED 
      ? '预约成功' 
      : '预约已创建，需要添加更多成员以确认'
  });
}

function addBookingMember(req, res) {
  const booking = storage.getBookingById(req.params.id);
  if (!booking) {
    return res.status(404).json({ success: false, error: '预约不存在' });
  }

  if (booking.status === BOOKING_STATUS.CANCELLED || 
      booking.status === BOOKING_STATUS.CHECKED_IN ||
      booking.status === BOOKING_STATUS.NO_SHOW) {
    return res.status(400).json({ success: false, error: '该预约状态不允许添加成员' });
  }

  const { studentId } = req.body;
  if (!studentId) {
    return res.status(400).json({ success: false, error: '缺少 studentId 参数' });
  }

  const student = storage.getStudentById(studentId);
  if (!student) {
    return res.status(404).json({ success: false, error: '学生不存在' });
  }

  const studentInstance = Object.assign(new Student(), student);
  if (!studentInstance.isAllowedToBook()) {
    return res.status(403).json({ 
      success: false, 
      error: `学生 ${student.name} 已被列入黑名单或信誉分不足，无法参与预约` 
    });
  }

  if (booking.members.includes(studentId)) {
    return res.status(409).json({ success: false, error: '该学生已是预约成员' });
  }

  booking.members.push(studentId);
  
  if (booking.members.length >= 2 && booking.status === BOOKING_STATUS.PENDING) {
    booking.status = BOOKING_STATUS.CONFIRMED;
  }

  storage.updateBooking(booking.id, booking);

  res.json({ 
    success: true, 
    data: booking,
    message: booking.status === BOOKING_STATUS.CONFIRMED 
      ? '成员添加成功，预约已确认' 
      : '成员添加成功'
  });
}

function cancelBooking(req, res) {
  const booking = storage.getBookingById(req.params.id);
  if (!booking) {
    return res.status(404).json({ success: false, error: '预约不存在' });
  }

  const bookingInstance = Object.assign(new Booking(), booking);
  
  if (!bookingInstance.canCancel()) {
    return res.status(400).json({ 
      success: false, 
      error: '该预约无法取消（可能已过取消截止时间或已签到）' 
    });
  }

  booking.status = BOOKING_STATUS.CANCELLED;
  booking.cancelledAt = new Date().toISOString();
  booking.cancelledBy = req.body.cancelledBy || booking.bookerId;

  const devices = storage.getDevicesByRoomId(booking.roomId);
  devices.forEach(device => {
    if (device.currentBookingId === booking.id) {
      storage.updateDevice(device.id, { 
        status: 'available', 
        currentBookingId: null 
      });
    }
  });

  storage.updateBooking(booking.id, booking);

  res.json({ success: true, data: booking, message: '预约已取消' });
}

function checkIn(req, res) {
  const booking = storage.getBookingById(req.params.id);
  if (!booking) {
    return res.status(404).json({ success: false, error: '预约不存在' });
  }

  const { studentId } = req.body;
  if (!studentId) {
    return res.status(400).json({ success: false, error: '缺少 studentId 参数' });
  }

  const student = storage.getStudentById(studentId);
  if (!student) {
    return res.status(404).json({ success: false, error: '学生不存在' });
  }

  if (!booking.members.includes(studentId)) {
    return res.status(403).json({ success: false, error: '该学生不是预约成员' });
  }

  const bookingInstance = Object.assign(new Booking(), booking);
  
  if (!bookingInstance.canCheckIn()) {
    if (booking.status !== BOOKING_STATUS.CONFIRMED) {
      return res.status(400).json({ success: false, error: '该预约状态不允许签到' });
    }
    return res.status(400).json({ 
      success: false, 
      error: '不在签到时间范围内（请在预约开始时间15分钟内签到）' 
    });
  }

  const existingRecords = storage.getCheckInRecordsByBookingId(booking.id);
  const alreadyCheckedIn = existingRecords.some(r => r.studentId === studentId);
  if (alreadyCheckedIn) {
    return res.status(409).json({ success: false, error: '该学生已签到' });
  }

  const { CheckInRecord } = require('../models');
  const checkInRecord = new CheckInRecord(null, booking.id, studentId);
  storage.addCheckInRecord(checkInRecord);

  if (!booking.checkInTime) {
    booking.checkInTime = checkInRecord.checkInTime;
    booking.status = BOOKING_STATUS.CHECKED_IN;

    const devices = storage.getDevicesByRoomId(booking.roomId);
    devices.forEach(device => {
      storage.updateDevice(device.id, { 
        status: 'in_use', 
        currentBookingId: booking.id 
      });
    });

    storage.updateBooking(booking.id, booking);
  }

  res.json({ 
    success: true, 
    data: { booking, checkInRecord },
    message: '签到成功'
  });
}

function processNoShow(req, res) {
  const booking = storage.getBookingById(req.params.id);
  if (!booking) {
    return res.status(404).json({ success: false, error: '预约不存在' });
  }

  const bookingInstance = Object.assign(new Booking(), booking);
  
  if (!bookingInstance.isNoShow()) {
    return res.status(400).json({ success: false, error: '该预约不是爽约状态' });
  }

  booking.status = BOOKING_STATUS.NO_SHOW;
  booking.noShowProcessed = true;
  storage.updateBooking(booking.id, booking);

  booking.members.forEach(memberId => {
    const student = storage.getStudentById(memberId);
    if (student) {
      const studentInstance = Object.assign(new Student(), student);
      studentInstance.recordNoShow();
      storage.updateStudent(memberId, {
        creditScore: studentInstance.creditScore,
        noShowCount: studentInstance.noShowCount,
        isBlacklisted: studentInstance.isBlacklisted,
        blacklistedUntil: studentInstance.blacklistedUntil
      });
    }
  });

  const devices = storage.getDevicesByRoomId(booking.roomId);
  devices.forEach(device => {
    if (device.currentBookingId === booking.id) {
      storage.updateDevice(device.id, { 
        status: 'available', 
        currentBookingId: null 
      });
    }
  });

  res.json({ 
    success: true, 
    data: booking,
    message: '爽约已处理，信誉分已扣除'
  });
}

module.exports = {
  getBookings,
  getBookingById,
  createBooking,
  addBookingMember,
  cancelBooking,
  checkIn,
  processNoShow
};