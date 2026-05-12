const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');

const defaultData = {
  rooms: [],
  devices: [],
  students: [],
  bookings: [],
  checkInRecords: [],
  version: '1.0.0'
};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadData() {
  ensureDataDir();
  
  if (!fs.existsSync(DATA_FILE)) {
    saveData(defaultData);
    return { ...defaultData };
  }
  
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    console.error('加载数据失败，使用默认数据:', e.message);
    return { ...defaultData };
  }
}

function saveData(data) {
  ensureDataDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function resetData() {
  saveData({ ...defaultData });
}

class Storage {
  constructor() {
    this.data = loadData();
  }

  save() {
    saveData(this.data);
  }

  reset() {
    this.data = { ...defaultData };
    this.save();
  }

  getRooms() {
    return this.data.rooms;
  }

  getRoomById(id) {
    return this.data.rooms.find(r => r.id === id);
  }

  addRoom(room) {
    if (!this.data.rooms.find(r => r.id === room.id)) {
      this.data.rooms.push(room);
      this.save();
    }
    return room;
  }

  getDevices() {
    return this.data.devices;
  }

  getDeviceById(id) {
    return this.data.devices.find(d => d.id === id);
  }

  getDevicesByRoomId(roomId) {
    return this.data.devices.filter(d => d.roomId === roomId);
  }

  addDevice(device) {
    if (!this.data.devices.find(d => d.id === device.id)) {
      this.data.devices.push(device);
      this.save();
    }
    return device;
  }

  updateDevice(deviceId, updates) {
    const index = this.data.devices.findIndex(d => d.id === deviceId);
    if (index !== -1) {
      this.data.devices[index] = { ...this.data.devices[index], ...updates };
      this.save();
      return this.data.devices[index];
    }
    return null;
  }

  getStudents() {
    return this.data.students;
  }

  getStudentById(id) {
    return this.data.students.find(s => s.id === id);
  }

  getStudentByStudentId(studentId) {
    return this.data.students.find(s => s.studentId === studentId);
  }

  addStudent(student) {
    if (!this.data.students.find(s => s.id === student.id || s.studentId === student.studentId)) {
      this.data.students.push(student);
      this.save();
    }
    return student;
  }

  updateStudent(studentId, updates) {
    const index = this.data.students.findIndex(s => s.id === studentId);
    if (index !== -1) {
      this.data.students[index] = { ...this.data.students[index], ...updates };
      this.save();
      return this.data.students[index];
    }
    return null;
  }

  getBookings() {
    return this.data.bookings;
  }

  getBookingById(id) {
    return this.data.bookings.find(b => b.id === id);
  }

  getBookingsByRoomId(roomId) {
    return this.data.bookings.filter(b => b.roomId === roomId);
  }

  getBookingsByStudentId(studentId) {
    return this.data.bookings.filter(b => 
      b.bookerId === studentId || b.members.includes(studentId)
    );
  }

  addBooking(booking) {
    const exists = this.data.bookings.find(b => 
      b.roomId === booking.roomId &&
      b.startTime === booking.startTime &&
      b.endTime === booking.endTime &&
      b.bookerId === booking.bookerId
    );
    if (!exists) {
      this.data.bookings.push(booking);
      this.save();
    }
    return booking;
  }

  updateBooking(bookingId, updates) {
    const index = this.data.bookings.findIndex(b => b.id === bookingId);
    if (index !== -1) {
      this.data.bookings[index] = { ...this.data.bookings[index], ...updates };
      this.save();
      return this.data.bookings[index];
    }
    return null;
  }

  deleteBooking(bookingId) {
    const index = this.data.bookings.findIndex(b => b.id === bookingId);
    if (index !== -1) {
      this.data.bookings.splice(index, 1);
      this.save();
      return true;
    }
    return false;
  }

  getCheckInRecords() {
    return this.data.checkInRecords;
  }

  getCheckInRecordsByBookingId(bookingId) {
    return this.data.checkInRecords.filter(r => r.bookingId === bookingId);
  }

  addCheckInRecord(record) {
    const exists = this.data.checkInRecords.find(r => 
      r.bookingId === record.bookingId && r.studentId === record.studentId
    );
    if (!exists) {
      this.data.checkInRecords.push(record);
      this.save();
    }
    return record;
  }

  hasOverlappingBooking(roomId, startTime, endTime, excludeBookingId = null) {
    return this.data.bookings.some(b => {
      if (excludeBookingId && b.id === excludeBookingId) return false;
      if (b.status === 'cancelled') return false;
      
      const bStart = new Date(b.startTime);
      const bEnd = new Date(b.endTime);
      const newStart = new Date(startTime);
      const newEnd = new Date(endTime);
      
      return (newStart < bEnd && newEnd > bStart);
    });
  }
}

module.exports = new Storage();
module.exports.Storage = Storage;
module.exports.resetData = resetData;