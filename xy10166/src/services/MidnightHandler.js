const { format } = require('date-fns');

class MidnightHandler {
  static _isSpanningMidnightUTC(startTime, endTime) {
    const startUTCDate = Date.UTC(
      startTime.getUTCFullYear(),
      startTime.getUTCMonth(),
      startTime.getUTCDate()
    );
    const endUTCDate = Date.UTC(
      endTime.getUTCFullYear(),
      endTime.getUTCMonth(),
      endTime.getUTCDate()
    );
    return startUTCDate !== endUTCDate;
  }

  static _getUTCMidnightAfter(date) {
    const midnight = new Date(date);
    midnight.setUTCHours(23, 59, 59, 999);
    return midnight;
  }

  static _getNextUTCDayStart(date) {
    const nextDay = new Date(date);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    nextDay.setUTCHours(0, 0, 0, 0);
    return nextDay;
  }

  static _formatUTCDate(date) {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  static splitMidnightAppointment(appointment) {
    const startTime = new Date(appointment.startTime);
    const endTime = new Date(appointment.endTime);
    
    if (!this._isSpanningMidnightUTC(startTime, endTime)) {
      return [{
        ...appointment,
        slotId: appointment.id,
        originalId: appointment.id,
        isSplit: false,
        slotDate: this._formatUTCDate(startTime)
      }];
    }
    
    const splitSlots = [];
    let currentStart = new Date(startTime);
    let segmentIndex = 0;
    
    while (currentStart < endTime) {
      const currentEnd = this._getUTCMidnightAfter(currentStart);
      const actualEnd = currentEnd < endTime ? currentEnd : endTime;
      const slotDate = this._formatUTCDate(currentStart);
      
      splitSlots.push({
        ...appointment,
        startTime: new Date(currentStart),
        endTime: new Date(actualEnd),
        slotId: `${appointment.id}_${slotDate}`,
        originalId: appointment.id,
        segmentIndex,
        isSplit: true,
        slotDate
      });
      
      segmentIndex++;
      currentStart = this._getNextUTCDayStart(currentStart);
    }
    
    return splitSlots;
  }
  
  static normalizeTimeSlots(appointments) {
    const normalizedSlots = [];
    
    for (const apt of appointments) {
      const splitSlots = this.splitMidnightAppointment(apt);
      normalizedSlots.push(...splitSlots);
    }
    
    return normalizedSlots;
  }
  
  static formatForDisplay(appointment) {
    const startTime = new Date(appointment.startTime);
    const endTime = new Date(appointment.endTime);
    
    if (appointment.spansMidnight && appointment.spansMidnight()) {
      return `${format(startTime, 'yyyy-MM-dd HH:mm')} → ${format(endTime, 'yyyy-MM-dd HH:mm')} (跨午夜)`;
    }
    
    return `${format(startTime, 'yyyy-MM-dd HH:mm')} → ${format(endTime, 'HH:mm')}`;
  }
}

module.exports = MidnightHandler;
