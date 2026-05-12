const store = require('../stores/memoryStore');
const moment = require('moment');

class TechnicianService {
  static checkAvailability(technicianId, startTime, endTime) {
    const tech = store.getTechnician(technicianId);
    if (!tech) {
      return { available: false, reason: '师傅不存在' };
    }

    const startMoment = moment(startTime);
    const endMoment = moment(endTime);

    for (const booking of tech.schedule) {
      const bookingStart = moment(booking.startTime);
      const bookingEnd = moment(booking.endTime);

      if (startMoment.isBefore(bookingEnd) && endMoment.isAfter(bookingStart)) {
        return {
          available: false,
          reason: '该时间段已有预约',
          conflictingBooking: booking
        };
      }
    }

    return { available: true };
  }

  static assignTechnician(orderId, technicianId, startTime, endTime, operator = 'system') {
    const tech = store.getTechnician(technicianId);
    if (!tech) {
      throw new Error('师傅不存在');
    }

    const availability = this.checkAvailability(technicianId, startTime, endTime);
    if (!availability.available) {
      throw new Error(availability.reason);
    }

    const booking = {
      orderId,
      startTime,
      endTime,
      assignedAt: store.now(),
      assignedBy: operator,
      status: 'active'
    };

    store.updateTechnician(technicianId, {
      schedule: [...tech.schedule, booking]
    });

    return booking;
  }

  static releaseTechnician(orderId, technicianId, operator = 'system') {
    const tech = store.getTechnician(technicianId);
    if (!tech) return;

    const updatedSchedule = tech.schedule.map(booking => {
      if (booking.orderId === orderId && booking.status === 'active') {
        return {
          ...booking,
          status: 'released',
          releasedAt: store.now(),
          releasedBy: operator
        };
      }
      return booking;
    });

    store.updateTechnician(technicianId, { schedule: updatedSchedule });
  }

  static reassignTechnician(orderId, oldTechnicianId, newTechnicianId, newStartTime, newEndTime, operator = 'system') {
    this.releaseTechnician(orderId, oldTechnicianId, operator);
    return this.assignTechnician(orderId, newTechnicianId, newStartTime, newEndTime, operator);
  }

  static findAvailableTechnician(skill, startTime, endTime, excludeTechnicianId = null) {
    const techs = store.listTechnicians({ skill });
    
    for (const tech of techs) {
      if (excludeTechnicianId && tech.id === excludeTechnicianId) continue;
      
      const availability = this.checkAvailability(tech.id, startTime, endTime);
      if (availability.available) {
        return tech;
      }
    }
    
    return null;
  }

  static getTechnicianWorkload(technicianId, startDate, endDate) {
    const tech = store.getTechnician(technicianId);
    if (!tech) return null;

    const startMoment = moment(startDate).startOf('day');
    const endMoment = moment(endDate).endOf('day');

    const assignments = tech.schedule.filter(booking => {
      const bookingStart = moment(booking.startTime);
      return bookingStart.isBetween(startMoment, endMoment, null, '[]');
    });

    const totalHours = assignments.reduce((sum, booking) => {
      const duration = moment(booking.endTime).diff(moment(booking.startTime), 'hours', true);
      return sum + duration;
    }, 0);

    return {
      technicianId,
      technicianName: tech.name,
      period: { start: startMoment.toISOString(), end: endMoment.toISOString() },
      totalAssignments: assignments.length,
      totalHours: Math.round(totalHours * 100) / 100,
      assignments
    };
  }

  static getAllTechniciansWorkload(startDate, endDate) {
    const techs = store.listTechnicians();
    return techs.map(tech => this.getTechnicianWorkload(tech.id, startDate, endDate));
  }

  static initializeTechnicians() {
    const technicians = [
      { name: '张师傅', phone: '13800138001', skills: ['空调', '洗衣机'] },
      { name: '李师傅', phone: '13800138002', skills: ['空调', '冰箱'] },
      { name: '王师傅', phone: '13800138003', skills: ['电视', '洗衣机'] },
      { name: '赵师傅', phone: '13800138004', skills: ['空调', '电视', '冰箱'] }
    ];

    for (const tech of technicians) {
      const existing = store.listTechnicians().find(t => t.phone === tech.phone);
      if (!existing) {
        store.createTechnician(tech);
      }
    }
  }
}

module.exports = TechnicianService;
