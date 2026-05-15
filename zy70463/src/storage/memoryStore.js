class MemoryStore {
  constructor() {
    this.reservations = [];
    this.inquiries = [];
    this.reservationCounter = 0;
    this.inquiryCounter = 0;
  }

  generateId() {
    return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  generateReservationNo() {
    const date = new Date();
    this.reservationCounter++;
    return `RES${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}${this.reservationCounter.toString().padStart(6, '0')}`;
  }

  generateInquiryNo() {
    const date = new Date();
    this.inquiryCounter++;
    return `INQ${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}${this.inquiryCounter.toString().padStart(6, '0')}`;
  }

  createReservation(data) {
    const reservation = {
      _id: this.generateId(),
      reservationNo: this.generateReservationNo(),
      ...data,
      status: data.status || 'pending',
      conflicts: data.conflicts || [],
      approval: data.approval || null,
      release: data.release || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.reservations.push(reservation);
    return reservation;
  }

  findReservationById(id) {
    return this.reservations.find(r => r._id === id);
  }

  findReservations(query = {}) {
    return this.reservations.filter(r => {
      for (const key in query) {
        if (query[key] && r[key] !== query[key]) {
          return false;
        }
      }
      return true;
    });
  }

  updateReservation(id, updates) {
    const index = this.reservations.findIndex(r => r._id === id);
    if (index === -1) return null;
    this.reservations[index] = {
      ...this.reservations[index],
      ...updates,
      updatedAt: new Date()
    };
    return this.reservations[index];
  }

  createInquiry(data) {
    const inquiry = {
      _id: this.generateId(),
      inquiryNo: this.generateInquiryNo(),
      ...data,
      status: data.status || 'draft',
      overallRemark: data.overallRemark || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.inquiries.push(inquiry);
    return inquiry;
  }

  findInquiryById(id) {
    return this.inquiries.find(i => i._id === id);
  }

  findInquiries(query = {}) {
    return this.inquiries.filter(i => {
      for (const key in query) {
        if (query[key] && i[key] !== query[key]) {
          return false;
        }
      }
      return true;
    });
  }

  updateInquiry(id, updates) {
    const index = this.inquiries.findIndex(i => i._id === id);
    if (index === -1) return null;
    this.inquiries[index] = {
      ...this.inquiries[index],
      ...updates,
      updatedAt: new Date()
    };
    return this.inquiries[index];
  }

  clearAll() {
    this.reservations = [];
    this.inquiries = [];
    this.reservationCounter = 0;
    this.inquiryCounter = 0;
  }
}

module.exports = new MemoryStore();
