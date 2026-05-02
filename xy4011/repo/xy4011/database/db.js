const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const ROOMS_FILE = path.join(DATA_DIR, 'rooms.json');
const RESERVATIONS_FILE = path.join(DATA_DIR, 'reservations.json');
const WAITLIST_FILE = path.join(DATA_DIR, 'waitlist.json');
const LOGS_FILE = path.join(DATA_DIR, 'logs.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJSON(filePath, defaultData = []) {
  if (!fs.existsSync(filePath)) {
    return defaultData;
  }
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`读取文件 ${filePath} 失败:`, error);
    return defaultData;
  }
}

function writeJSON(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error(`写入文件 ${filePath} 失败:`, error);
    throw error;
  }
}

let nextIds = {
  rooms: 1,
  reservations: 1,
  waitlist: 1,
  logs: 1
};

function initializeNextIds() {
  const rooms = readJSON(ROOMS_FILE, []);
  const reservations = readJSON(RESERVATIONS_FILE, []);
  const waitlist = readJSON(WAITLIST_FILE, []);
  const logs = readJSON(LOGS_FILE, []);
  
  if (rooms.length > 0) {
    nextIds.rooms = Math.max(...rooms.map(r => r.id)) + 1;
  }
  if (reservations.length > 0) {
    nextIds.reservations = Math.max(...reservations.map(r => r.id)) + 1;
  }
  if (waitlist.length > 0) {
    nextIds.waitlist = Math.max(...waitlist.map(w => w.id)) + 1;
  }
  if (logs.length > 0) {
    nextIds.logs = Math.max(...logs.map(l => l.id)) + 1;
  }
}

initializeNextIds();

const db = {
  getRooms() {
    return readJSON(ROOMS_FILE, []);
  },
  
  getRoomById(id) {
    const rooms = readJSON(ROOMS_FILE, []);
    return rooms.find(r => r.id === id);
  },
  
  insertRoom(room) {
    const rooms = readJSON(ROOMS_FILE, []);
    const existing = rooms.find(r => r.name === room.name);
    if (existing) {
      return { changes: 0 };
    }
    const newRoom = {
      id: nextIds.rooms++,
      ...room,
      created_at: new Date().toISOString()
    };
    rooms.push(newRoom);
    writeJSON(ROOMS_FILE, rooms);
    return { changes: 1, lastInsertRowid: newRoom.id };
  },
  
  getReservations() {
    return readJSON(RESERVATIONS_FILE, []);
  },
  
  getReservationById(id) {
    const reservations = readJSON(RESERVATIONS_FILE, []);
    return reservations.find(r => r.id === id);
  },
  
  insertReservation(reservation) {
    const reservations = readJSON(RESERVATIONS_FILE, []);
    const now = new Date().toISOString();
    const newReservation = {
      id: nextIds.reservations++,
      ...reservation,
      created_at: now,
      updated_at: now
    };
    reservations.push(newReservation);
    writeJSON(RESERVATIONS_FILE, reservations);
    return { changes: 1, lastInsertRowid: newReservation.id };
  },
  
  updateReservationStatus(id, status) {
    const reservations = readJSON(RESERVATIONS_FILE, []);
    const index = reservations.findIndex(r => r.id === id);
    if (index === -1) {
      return { changes: 0 };
    }
    reservations[index].status = status;
    reservations[index].updated_at = new Date().toISOString();
    writeJSON(RESERVATIONS_FILE, reservations);
    return { changes: 1 };
  },
  
  getWaitlist() {
    return readJSON(WAITLIST_FILE, []);
  },
  
  getWaitlistByReservationId(reservationId) {
    const waitlist = readJSON(WAITLIST_FILE, []);
    return waitlist.find(w => w.reservation_id === reservationId);
  },
  
  getWaitlistForSlot(roomId, date, startTime, endTime) {
    const waitlist = readJSON(WAITLIST_FILE, []);
    const reservations = readJSON(RESERVATIONS_FILE, []);
    
    return waitlist
      .filter(w => {
        const r = reservations.find(r => r.id === w.reservation_id);
        return r && 
               r.room_id === roomId && 
               r.date === date && 
               r.start_time === startTime && 
               r.end_time === endTime &&
               r.status === 'waitlisted';
      })
      .sort((a, b) => a.position - b.position)
      .map(w => {
        const r = reservations.find(r => r.id === w.reservation_id);
        const rooms = readJSON(ROOMS_FILE, []);
        const room = rooms.find(rm => rm.id === r.room_id);
        return {
          ...w,
          ...r,
          room_name: room ? room.name : null
        };
      });
  },
  
  insertWaitlist(waitlistItem) {
    const waitlist = readJSON(WAITLIST_FILE, []);
    const newItem = {
      id: nextIds.waitlist++,
      ...waitlistItem,
      created_at: new Date().toISOString()
    };
    waitlist.push(newItem);
    writeJSON(WAITLIST_FILE, waitlist);
    return { changes: 1, lastInsertRowid: newItem.id };
  },
  
  deleteWaitlistByReservationId(reservationId) {
    const waitlist = readJSON(WAITLIST_FILE, []);
    const index = waitlist.findIndex(w => w.reservation_id === reservationId);
    if (index === -1) {
      return { changes: 0 };
    }
    waitlist.splice(index, 1);
    writeJSON(WAITLIST_FILE, waitlist);
    return { changes: 1 };
  },
  
  updateWaitlistPositions(roomId, date, startTime, endTime) {
    const waitlist = readJSON(WAITLIST_FILE, []);
    const reservations = readJSON(RESERVATIONS_FILE, []);
    
    const relevantItems = waitlist
      .filter(w => {
        const r = reservations.find(r => r.id === w.reservation_id);
        return r && 
               r.room_id === roomId && 
               r.date === date && 
               r.start_time === startTime && 
               r.end_time === endTime &&
               r.status === 'waitlisted';
      })
      .sort((a, b) => a.position - b.position);
    
    relevantItems.forEach((item, index) => {
      const w = waitlist.find(wl => wl.id === item.id);
      if (w) {
        w.position = index + 1;
      }
    });
    
    writeJSON(WAITLIST_FILE, waitlist);
  },
  
  insertLog(log) {
    const logs = readJSON(LOGS_FILE, []);
    const newLog = {
      id: nextIds.logs++,
      ...log,
      created_at: new Date().toISOString()
    };
    logs.push(newLog);
    writeJSON(LOGS_FILE, logs);
    return { changes: 1, lastInsertRowid: newLog.id };
  },
  
  prepare(query) {
    return {
      run(...params) {
        if (query.includes('INSERT OR IGNORE INTO rooms')) {
          const [name, capacity, description] = params;
          return db.insertRoom({ name, capacity, description });
        }
        
        if (query.includes('INSERT INTO reservations')) {
          const [roomId, userName, userPhone, date, startTime, endTime, peopleCount, purpose, status] = params;
          return db.insertReservation({
            room_id: roomId,
            user_name: userName,
            user_phone: userPhone,
            date,
            start_time: startTime,
            end_time: endTime,
            people_count: peopleCount,
            purpose,
            status
          });
        }
        
        if (query.includes('INSERT INTO waitlist')) {
          const [reservationId, position] = params;
          return db.insertWaitlist({
            reservation_id: reservationId,
            position
          });
        }
        
        if (query.includes('UPDATE reservations') && query.includes('status')) {
          const [status, id] = params;
          return db.updateReservationStatus(id, status);
        }
        
        if (query.includes('DELETE FROM waitlist')) {
          if (query.includes('reservation_id')) {
            const [reservationId] = params;
            return db.deleteWaitlistByReservationId(reservationId);
          }
        }
        
        if (query.includes('INSERT INTO operation_logs')) {
          const [reservationId, action, details, operator] = params;
          return db.insertLog({
            reservation_id: reservationId,
            action,
            details,
            operator
          });
        }
        
        return { changes: 0 };
      },
      
      get(...params) {
        if (query.includes('SELECT * FROM rooms WHERE id')) {
          const [id] = params;
          return db.getRoomById(id);
        }
        
        if (query.includes('SELECT r.*, rm.name as room_name') && 
            query.includes('FROM reservations r') && 
            query.includes('WHERE r.id')) {
          const [id] = params;
          const reservation = db.getReservationById(id);
          if (!reservation) return undefined;
          const room = db.getRoomById(reservation.room_id);
          const waitlist = db.getWaitlistByReservationId(id);
          return {
            ...reservation,
            room_name: room ? room.name : null,
            room_capacity: room ? room.capacity : null,
            waitlist_position: waitlist ? waitlist.position : null
          };
        }
        
        return undefined;
      },
      
      all(...params) {
        if (query.includes('SELECT * FROM rooms ORDER BY name')) {
          return db.getRooms();
        }
        
        if (query.includes('SELECT COUNT(*) as count FROM reservations')) {
          const reservations = db.getReservations();
          let filtered = reservations;
          
          if (query.includes('date >= ?') && query.includes('date <= ?')) {
            const [startDate, endDate] = params;
            filtered = reservations.filter(r => r.date >= startDate && r.date <= endDate);
          }
          
          if (query.includes('status =')) {
            const statusMatch = query.match(/status = '(\w+)'/);
            if (statusMatch) {
              filtered = filtered.filter(r => r.status === statusMatch[1]);
            }
          }
          
          return [{ count: filtered.length }];
        }
        
        if (query.includes('SELECT rm.id, rm.name, COUNT(r.id) as reservation_count') &&
            query.includes('GROUP BY rm.id, rm.name')) {
          const [startDate, endDate] = params;
          const reservations = db.getReservations().filter(r => 
            r.date >= startDate && r.date <= endDate && r.status === 'confirmed'
          );
          const rooms = db.getRooms();
          
          const counts = {};
          reservations.forEach(r => {
            counts[r.room_id] = (counts[r.room_id] || 0) + 1;
          });
          
          return rooms
            .filter(rm => counts[rm.id] > 0)
            .map(rm => ({
              id: rm.id,
              name: rm.name,
              reservation_count: counts[rm.id]
            }))
            .sort((a, b) => b.reservation_count - a.reservation_count);
        }
        
        if (query.includes('SELECT strftime') && query.includes('GROUP BY strftime')) {
          const [startDate, endDate] = params;
          const reservations = db.getReservations().filter(r => 
            r.date >= startDate && r.date <= endDate && r.status === 'confirmed'
          );
          
          const hourCounts = {};
          reservations.forEach(r => {
            const hour = r.start_time.split(':')[0];
            hourCounts[hour] = (hourCounts[hour] || 0) + 1;
          });
          
          return Object.entries(hourCounts)
            .map(([hour, count]) => ({ hour, reservation_count: count }))
            .sort((a, b) => b.reservation_count - a.reservation_count);
        }
        
        if (query.includes('SELECT r.*, rm.name as room_name, rm.capacity as room_capacity')) {
          const reservations = db.getReservations();
          const rooms = db.getRooms();
          const waitlist = db.getWaitlist();
          
          let filtered = [...reservations];
          
          let roomIdIndex = -1;
          let dateIndex = -1;
          let statusIndex = -1;
          
          if (query.includes('r.room_id = ?')) {
            roomIdIndex = query.indexOf('r.room_id = ?');
          }
          if (query.includes('r.date = ?')) {
            dateIndex = query.indexOf('r.date = ?');
          }
          if (query.includes('r.status = ?')) {
            statusIndex = query.indexOf('r.status = ?');
          }
          
          const conditions = [];
          if (roomIdIndex >= 0) conditions.push({ type: 'roomId', pos: roomIdIndex });
          if (dateIndex >= 0) conditions.push({ type: 'date', pos: dateIndex });
          if (statusIndex >= 0) conditions.push({ type: 'status', pos: statusIndex });
          
          conditions.sort((a, b) => a.pos - b.pos);
          
          let paramIndex = 0;
          conditions.forEach(cond => {
            if (cond.type === 'roomId') {
              filtered = filtered.filter(r => r.room_id === params[paramIndex]);
            } else if (cond.type === 'date') {
              filtered = filtered.filter(r => r.date === params[paramIndex]);
            } else if (cond.type === 'status') {
              filtered = filtered.filter(r => r.status === params[paramIndex]);
            }
            paramIndex++;
          });
          
          return filtered.map(r => {
            const room = rooms.find(rm => rm.id === r.room_id);
            const w = waitlist.find(wl => wl.reservation_id === r.id);
            return {
              ...r,
              room_name: room ? room.name : null,
              room_capacity: room ? room.capacity : null,
              waitlist_position: w ? w.position : null
            };
          });
        }
        
        return [];
      }
    };
  }
};

module.exports = db;
