const { v4: uuidv4 } = require('uuid');

const BOOKING_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  CHECKED_IN: 'checked_in',
  CANCELLED: 'cancelled',
  NO_SHOW: 'no_show'
};

const CANCELLATION_DEADLINE_MINUTES = 0.5;
const MIN_REQUIRED_MEMBERS = 2;
const MAX_NO_SHOWS = 3;
const CREDIT_SCORE_PENALTY = 20;
const INITIAL_CREDIT_SCORE = 100;

class Room {
  constructor(id, name, capacity, location, facilities = []) {
    this.id = id || uuidv4();
    this.name = name;
    this.capacity = capacity;
    this.location = location;
    this.facilities = facilities;
    this.isActive = true;
    this.createdAt = new Date().toISOString();
  }
}

class Device {
  constructor(id, name, type, roomId, status = 'available') {
    this.id = id || uuidv4();
    this.name = name;
    this.type = type;
    this.roomId = roomId;
    this.status = status;
    this.currentBookingId = null;
    this.createdAt = new Date().toISOString();
  }
}

class Student {
  constructor(id, studentId, name, email, creditScore = INITIAL_CREDIT_SCORE) {
    this.id = id || uuidv4();
    this.studentId = studentId;
    this.name = name;
    this.email = email;
    this.creditScore = creditScore;
    this.noShowCount = 0;
    this.isBlacklisted = false;
    this.blacklistedUntil = null;
    this.createdAt = new Date().toISOString();
  }

  isAllowedToBook() {
    if (this.isBlacklisted) {
      if (this.blacklistedUntil && new Date(this.blacklistedUntil) > new Date()) {
        return false;
      }
      this.isBlacklisted = false;
      this.blacklistedUntil = null;
    }
    return this.creditScore > 0;
  }

  recordNoShow() {
    this.noShowCount++;
    this.creditScore = Math.max(0, this.creditScore - CREDIT_SCORE_PENALTY);
    
    if (this.noShowCount >= MAX_NO_SHOWS) {
      this.isBlacklisted = true;
      const blacklistUntil = new Date();
      blacklistUntil.setDate(blacklistUntil.getDate() + 7);
      this.blacklistedUntil = blacklistUntil.toISOString();
    }
  }
}

class Booking {
  constructor(id, roomId, bookerId, startTime, endTime, purpose = '') {
    this.id = id || uuidv4();
    this.roomId = roomId;
    this.bookerId = bookerId;
    this.startTime = startTime;
    this.endTime = endTime;
    this.purpose = purpose;
    this.status = BOOKING_STATUS.PENDING;
    this.members = [];
    this.checkInTime = null;
    this.checkOutTime = null;
    this.cancelledAt = null;
    this.cancelledBy = null;
    this.noShowProcessed = false;
    this.createdAt = new Date().toISOString();
  }

  addMember(studentId) {
    if (!this.members.includes(studentId)) {
      this.members.push(studentId);
    }
  }

  hasEnoughMembers() {
    return this.members.length >= MIN_REQUIRED_MEMBERS;
  }

  canCancel() {
    if (this.status !== BOOKING_STATUS.PENDING && 
        this.status !== BOOKING_STATUS.CONFIRMED) {
      return false;
    }
    const deadline = new Date(this.startTime);
    deadline.setMinutes(deadline.getMinutes() - CANCELLATION_DEADLINE_MINUTES);
    return new Date() < deadline;
  }

  canCheckIn() {
    if (this.status !== BOOKING_STATUS.CONFIRMED) return false;
    const now = new Date();
    const start = new Date(this.startTime);
    const gracePeriod = new Date(start);
    gracePeriod.setSeconds(gracePeriod.getSeconds() + 5);
    return now >= start && now <= gracePeriod;
  }

  isNoShow() {
    if (this.status === BOOKING_STATUS.CHECKED_IN || 
        this.status === BOOKING_STATUS.CANCELLED ||
        this.noShowProcessed) {
      return false;
    }
    const now = new Date();
    const gracePeriod = new Date(this.startTime);
    gracePeriod.setSeconds(gracePeriod.getSeconds() + 10);
    return now > gracePeriod;
  }
}

class CheckInRecord {
  constructor(id, bookingId, studentId, checkInTime = null) {
    this.id = id || uuidv4();
    this.bookingId = bookingId;
    this.studentId = studentId;
    this.checkInTime = checkInTime || new Date().toISOString();
  }
}

module.exports = {
  Room,
  Device,
  Student,
  Booking,
  CheckInRecord,
  BOOKING_STATUS,
  CANCELLATION_DEADLINE_MINUTES,
  MIN_REQUIRED_MEMBERS,
  MAX_NO_SHOWS,
  CREDIT_SCORE_PENALTY,
  INITIAL_CREDIT_SCORE
};