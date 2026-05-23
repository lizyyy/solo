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
    const sorted = [...bookings].sort((a, b) => a.checkIn - b.checkIn);
    const result = [];
    
    for (const booking of sorted) {
      if (result.length === 0) {
        result.push({
          ...booking,
          checkIn: booking.checkIn,
          checkOut: booking.checkOut,
          sources: [booking]
        });
      } else {
        const last = result[result.length - 1];
        
        const isSameGuest = booking.guest && last.guest && booking.guest === last.guest;
        const isSameReason = booking.reason === last.reason;
        const isContiguous = booking.checkIn.getTime() === last.checkOut.getTime();
        
        if (isContiguous && (isSameGuest || isSameReason)) {
          last.checkOut = booking.checkOut;
          last.sources.push(booking);
          if (!last.guest && booking.guest) {
            last.guest = booking.guest;
          }
        } else {
          result.push({
            ...booking,
            checkIn: booking.checkIn,
            checkOut: booking.checkOut,
            sources: [booking]
          });
        }
      }
    }
    
    merged[roomName] = result;
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
