const { addDays, format } = require('date-fns');

class MidnightHandler {
  static splitMidnightAppointment(appointment) {
    const startTime = new Date(appointment.startTime);
    const endTime = new Date(appointment.endTime);
    
    const startDate = startTime.toDateString();
    const endDate = endTime.toDateString();
    
    if (startDate === endDate) {
      return [appointment];
    }
    
    const splitSlots = [];
    let currentStart = new Date(startTime);
    
    while (currentStart < endTime) {
      const currentEnd = new Date(currentStart);
      currentEnd.setHours(23, 59, 59, 999);
      
      if (currentEnd >= endTime) {
        currentEnd.setTime(endTime.getTime());
      }
      
      splitSlots.push({
        ...appointment,
        startTime: new Date(currentStart),
        endTime: new Date(currentEnd),
        originalId: appointment.id,
        isSplit: true,
        slotDate: format(currentStart, 'yyyy-MM-dd')
      });
      
      currentStart = addDays(currentStart, 1);
      currentStart.setHours(0, 0, 0, 0);
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
