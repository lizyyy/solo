import { formatDate, datesOverlap, getNights } from './date.js';

export function groupByRoom(bookings) {
  const validBookings = bookings.filter(b => !b.hasErrors && b.checkIn && b.checkOut);
  const groups = {};
  
  for (const booking of validBookings) {
    const roomKey = booking.roomName || booking.roomId || 'unknown';
    if (!groups[roomKey]) {
      groups[roomKey] = [];
    }
    groups[roomKey].push(booking);
  }
  
  return groups;
}

export function detectConflicts(bookingsByRoom) {
  const conflicts = [];
  
  for (const [roomName, bookings] of Object.entries(bookingsByRoom)) {
    const sorted = [...bookings].sort((a, b) => a.checkIn - b.checkIn);
    
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const a = sorted[i];
        const b = sorted[j];
        
        if (datesOverlap(a.checkIn, a.checkOut, b.checkIn, b.checkOut)) {
          const overlapStart = a.checkIn > b.checkIn ? a.checkIn : b.checkIn;
          const overlapEnd = a.checkOut < b.checkOut ? a.checkOut : b.checkOut;
          
          const isLockConflict = (a.reason && a.reason.includes('锁')) || 
                                 (b.reason && b.reason.includes('锁'));
          
          conflicts.push({
            type: isLockConflict ? 'lock_conflict' : 'booking_conflict',
            roomName,
            bookings: [a, b],
            overlapStart,
            overlapEnd,
            nights: getNights(overlapStart, overlapEnd),
            message: isLockConflict 
              ? `订房与锁房冲突: ${formatDate(overlapStart)} 至 ${formatDate(overlapEnd)}`
              : `订单冲突: ${formatDate(overlapStart)} 至 ${formatDate(overlapEnd)}`
          });
        }
      }
    }
  }
  
  return conflicts;
}

export function mergeContiguousBookings(bookingsByRoom) {
  const merged = {};
  
  for (const [roomName, bookings] of Object.entries(bookingsByRoom)) {
    const groups = {};
    
    for (const booking of bookings) {
      const isLock = booking.reason && 
        (booking.reason.includes('锁') || booking.reason.includes('维护') || 
         booking.reason.includes('自用') || booking.reason.includes('block'));
      
      let groupKey;
      if (isLock) {
        groupKey = `lock:${booking.reason}`;
      } else if (booking.guest) {
        groupKey = `guest:${booking.guest}`;
      } else {
        groupKey = `other:${booking.id}`;
      }
      
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(booking);
    }
    
    const result = [];
    
    for (const groupBookings of Object.values(groups)) {
      const sorted = [...groupBookings].sort((a, b) => a.checkIn - b.checkIn);
      
      if (sorted.length === 0) continue;
      
      let current = {
        ...sorted[0],
        checkIn: sorted[0].checkIn,
        checkOut: sorted[0].checkOut,
        sources: [sorted[0]]
      };
      
      for (let i = 1; i < sorted.length; i++) {
        const booking = sorted[i];
        const isContiguous = booking.checkIn.getTime() === current.checkOut.getTime();
        const isOverlapping = booking.checkIn.getTime() <= current.checkOut.getTime();
        
        if (isContiguous || isOverlapping) {
          if (booking.checkOut > current.checkOut) {
            current.checkOut = booking.checkOut;
          }
          current.sources.push(booking);
          if (!current.guest && booking.guest) {
            current.guest = booking.guest;
          }
        } else {
          result.push(current);
          current = {
            ...booking,
            checkIn: booking.checkIn,
            checkOut: booking.checkOut,
            sources: [booking]
          };
        }
      }
      
      result.push(current);
    }
    
    merged[roomName] = result.sort((a, b) => a.checkIn - b.checkIn);
  }
  
  return merged;
}

export function separateLockBookings(mergedBookings) {
  const lockBookings = {};
  const regularBookings = {};
  
  for (const [roomName, bookings] of Object.entries(mergedBookings)) {
    lockBookings[roomName] = [];
    regularBookings[roomName] = [];
    
    for (const booking of bookings) {
      const isLock = booking.reason && 
        (booking.reason.includes('锁') || 
         booking.reason.includes('维护') || 
         booking.reason.includes('自用') ||
         booking.reason.includes('block'));
      
      if (isLock) {
        lockBookings[roomName].push(booking);
      } else {
        regularBookings[roomName].push(booking);
      }
    }
  }
  
  return { lockBookings, regularBookings };
}
