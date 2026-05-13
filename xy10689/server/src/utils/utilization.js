const moment = require('moment');
const db = require('../db');

function calculateUtilization(startDate, endDate) {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT 
        r.id as room_id,
        r.name as room_name,
        b.id as booking_id,
        b.start_time,
        b.end_time,
        b.status,
        c.released_hours
      FROM meeting_rooms r
      LEFT JOIN bookings b ON r.id = b.room_id
      LEFT JOIN cancellations c ON b.id = c.booking_id
      WHERE b.start_time >= ? AND b.end_time <= ?
      ORDER BY r.id, b.start_time
    `, [startDate, endDate], (err, bookings) => {
      if (err) return reject(err);

      const rooms = {};
      const totalWorkingHours = 8; 
      const daysInPeriod = moment(endDate).diff(moment(startDate), 'days') + 1;
      const totalAvailableHours = daysInPeriod * totalWorkingHours;

      bookings.forEach(booking => {
        if (!rooms[booking.room_id]) {
          rooms[booking.room_id] = {
            room_id: booking.room_id,
            room_name: booking.room_name,
            totalBookedHours: 0,
            cancelledHours: 0,
            actualUsedHours: 0,
            bookingCount: 0,
            cancelledCount: 0,
          };
        }

        const room = rooms[booking.room_id];
        const duration = moment(booking.end_time).diff(moment(booking.start_time), 'hours', true);
        
        room.bookingCount++;

        if (booking.status === 'cancelled') {
          room.cancelledCount++;
          room.cancelledHours += booking.released_hours || duration;
        } else {
          room.totalBookedHours += duration;
          room.actualUsedHours += duration;
        }
      });

      const result = Object.values(rooms).map(room => ({
        ...room,
        utilizationRate: totalAvailableHours > 0 
          ? ((room.actualUsedHours / (totalAvailableHours / Object.keys(rooms).length)) * 100).toFixed(2)
          : 0,
        releaseRate: room.totalBookedHours > 0 
          ? ((room.cancelledHours / (room.totalBookedHours + room.cancelledHours)) * 100).toFixed(2)
          : 0,
      }));

      resolve(result);
    });
  });
}

function getStatistics(startDate, endDate) {
  return Promise.all([
    calculateUtilization(startDate, endDate),
    new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM fault_tickets WHERE status != "resolved"', (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    }),
    new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM tea_services WHERE status = "pending"', (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    }),
    new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM anomalies WHERE status = "pending"', (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    }),
  ]).then(([utilization, faultCount, pendingTeaCount, pendingAnomalyCount]) => {
    const avgUtilization = utilization.length > 0
      ? (utilization.reduce((sum, r) => sum + parseFloat(r.utilizationRate), 0) / utilization.length).toFixed(2)
      : 0;

    return {
      avgUtilization,
      totalBookings: utilization.reduce((sum, r) => sum + r.bookingCount, 0),
      faultCount,
      pendingTeaCount,
      pendingAnomalyCount,
      utilizationDetails: utilization,
    };
  });
}

module.exports = { calculateUtilization, getStatistics };
