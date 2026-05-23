import { writeFileSync } from 'fs';
import { formatDate, getNights } from '../utils/date.js';

function serializeBooking(booking) {
  return {
    id: booking.id,
    roomName: booking.roomName,
    roomId: booking.roomId,
    checkIn: formatDate(booking.checkIn),
    checkOut: formatDate(booking.checkOut),
    nights: getNights(booking.checkIn, booking.checkOut),
    guest: booking.guest,
    reason: booking.reason,
    platform: booking.platform,
    source: booking.source,
    rowIndex: booking.rowIndex,
    sources: booking.sources ? booking.sources.map(s => ({
      id: s.id,
      platform: s.platform,
      source: s.source,
      rowIndex: s.rowIndex
    })) : undefined
  };
}

function serializeConflict(conflict) {
  return {
    type: conflict.type,
    roomName: conflict.roomName,
    overlapStart: formatDate(conflict.overlapStart),
    overlapEnd: formatDate(conflict.overlapEnd),
    nights: conflict.nights,
    message: conflict.message,
    bookings: conflict.bookings.map(b => ({
      id: b.id,
      platform: b.platform,
      source: b.source,
      rowIndex: b.rowIndex,
      guest: b.guest,
      reason: b.reason,
      checkIn: formatDate(b.checkIn),
      checkOut: formatDate(b.checkOut)
    }))
  };
}

export function generateJSON(result, outputPath) {
  const output = {
    generatedAt: new Date().toISOString(),
    sources: result.sources.map(s => ({
      filePath: s.filePath,
      platform: s.platform,
      rowCount: s.rowCount
    })),
    stats: result.stats,
    errors: result.errors.map(e => ({
      message: e.message,
      row: e.row,
      column: e.column,
      value: e.value,
      source: e.source
    })),
    conflicts: result.conflicts.map(serializeConflict),
    mergedBookings: Object.fromEntries(
      Object.entries(result.mergedBookings).map(([room, bookings]) => [
        room,
        bookings.map(serializeBooking)
      ])
    ),
    lockBookings: Object.fromEntries(
      Object.entries(result.lockBookings).map(([room, bookings]) => [
        room,
        bookings.map(serializeBooking)
      ])
    ),
    invalidRecords: result.invalidRecords.map(r => ({
      ...r,
      checkIn: r.checkIn ? formatDate(r.checkIn) : r.checkInStr,
      checkOut: r.checkOut ? formatDate(r.checkOut) : r.checkOutStr
    }))
  };

  writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');
}
