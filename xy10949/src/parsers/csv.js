import { readFileSync } from 'fs';
import { parseDate } from '../utils/date.js';
import { validateBooking } from '../utils/validation.js';

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  
  return result;
}

export function parseCSV(filePath, options = {}) {
  const {
    platform = 'unknown',
    roomColumn = ['房源', '房间', 'room', '房源名称', 'roomName'],
    checkInColumn = ['入住', '入住日期', 'checkin', 'checkIn', 'arrival'],
    checkOutColumn = ['退房', '退房日期', 'checkout', 'checkOut', 'departure'],
    reasonColumn = ['原因', '备注', 'reason', 'note', '锁房原因', '状态'],
    guestColumn = ['客人', '客户', 'guest', '姓名', '房客'],
    encoding = 'utf-8'
  } = options;

  const bookings = [];
  const errors = [];
  const content = readFileSync(filePath, encoding);
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  
  if (lines.length === 0) {
    return { bookings, errors, platform, source: filePath, rowCount: 0 };
  }

  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine).map(h => h.trim());
  
  const findColumnIndex = (candidates) => {
    for (const candidate of candidates) {
      for (let i = 0; i < headers.length; i++) {
        if (headers[i].toLowerCase().includes(candidate.toLowerCase())) {
          return i;
        }
      }
    }
    return -1;
  };

  const roomIdx = findColumnIndex(roomColumn);
  const checkInIdx = findColumnIndex(checkInColumn);
  const checkOutIdx = findColumnIndex(checkOutColumn);
  const reasonIdx = findColumnIndex(reasonColumn);
  const guestIdx = findColumnIndex(guestColumn);

  let recordCount = 0;

  for (let lineNum = 1; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];
    const physicalRowIndex = lineNum + 1;
    
    if (!line.trim()) continue;
    
    const values = parseCSVLine(line);
    if (values.every(v => !v.trim())) continue;
    
    recordCount++;
    
    const roomValue = roomIdx >= 0 ? values[roomIdx] || '' : '';
    const checkInStr = checkInIdx >= 0 ? values[checkInIdx] || '' : '';
    const checkOutStr = checkOutIdx >= 0 ? values[checkOutIdx] || '' : '';
    const reasonValue = reasonIdx >= 0 ? values[reasonIdx] || '' : '';
    const guestValue = guestIdx >= 0 ? values[guestIdx] || '' : '';

    const checkIn = parseDate(checkInStr);
    const checkOut = parseDate(checkOutStr);

    const booking = {
      id: `${platform}-${physicalRowIndex}`,
      roomId: roomValue,
      roomName: roomValue,
      checkIn,
      checkOut,
      checkInStr,
      checkOutStr,
      reason: reasonValue || '',
      guest: guestValue || '',
      platform,
      source: filePath,
      rowIndex: physicalRowIndex,
      rawRow: Object.fromEntries(headers.map((h, i) => [h, values[i] || '']))
    };

    const validationErrors = validateBooking(booking, physicalRowIndex, filePath);
    if (validationErrors.length > 0) {
      errors.push(...validationErrors);
      booking.hasErrors = true;
      booking.errors = validationErrors;
    }

    bookings.push(booking);
  }

  return {
    bookings,
    errors,
    platform,
    source: filePath,
    rowCount: recordCount
  };
}
