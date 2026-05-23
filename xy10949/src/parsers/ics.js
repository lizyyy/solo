import { readFileSync } from 'fs';
import { parseDate } from '../utils/date.js';
import { validateBooking } from '../utils/validation.js';

function parseICSLine(line) {
  const match = line.match(/^([A-Z-]+)(?:;([^:]*))?:(.*)$/);
  if (match) {
    return {
      key: match[1],
      params: match[2] || '',
      value: match[3]
    };
  }
  return null;
}

export function parseICS(filePath, options = {}) {
  const { platform = 'unknown' } = options;
  
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  
  const bookings = [];
  const errors = [];
  let currentEvent = null;
  let rowIndex = 0;
  let eventStartRow = 0;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    rowIndex = i + 1;
    
    while (i + 1 < lines.length && lines[i + 1].startsWith(' ')) {
      line += lines[i + 1].substring(1);
      i++;
    }

    const parsed = parseICSLine(line);
    if (!parsed) continue;

    if (parsed.key === 'BEGIN' && parsed.value === 'VEVENT') {
      currentEvent = {};
      eventStartRow = rowIndex;
    } else if (parsed.key === 'END' && parsed.value === 'VEVENT' && currentEvent) {
      const summary = currentEvent.SUMMARY || currentEvent.DESCRIPTION || '';
      
      let roomName = '';
      let guest = '';
      let reason = '';
      
      const colonIndex = summary.indexOf(':');
      if (colonIndex > 0) {
        roomName = summary.substring(0, colonIndex).trim();
        const afterColon = summary.substring(colonIndex + 1).trim();
        
        if (afterColon.startsWith('锁房') || afterColon.startsWith('维护') || 
            afterColon.startsWith('自用') || afterColon.startsWith('block') ||
            afterColon.includes('锁房') || afterColon.includes('维护')) {
          reason = afterColon;
        } else {
          guest = afterColon;
        }
      } else {
        const roomMatch = summary.match(/(?:房源|房间|room|Room):\s*([^\n,]+)/i) || 
                         summary.match(/^([^\n,:]+)$/);
        const reasonMatch = summary.match(/(?:原因|备注|reason|锁房|维护|保洁|自用):\s*([^\n,]+)/i);
        const guestMatch = summary.match(/(?:客人|客户|guest|房客):\s*([^\n,]+)/i);

        roomName = roomMatch ? roomMatch[1].trim() : summary.trim();
        reason = reasonMatch ? reasonMatch[1].trim() : '';
        guest = guestMatch ? guestMatch[1].trim() : '';
      }

      const checkIn = currentEvent.DTSTART ? parseDate(currentEvent.DTSTART) : null;
      const checkOut = currentEvent.DTEND ? parseDate(currentEvent.DTEND) : null;

      const booking = {
        id: `${platform}-ics-${bookings.length + 1}`,
        roomId: roomName,
        roomName,
        checkIn,
        checkOut,
        checkInStr: currentEvent.DTSTART || '',
        checkOutStr: currentEvent.DTEND || '',
        reason,
        guest,
        platform,
        source: filePath,
        rowIndex: eventStartRow,
        rawRow: currentEvent,
        uid: currentEvent.UID || ''
      };

      const validationErrors = validateBooking(booking, eventStartRow, filePath);
      if (validationErrors.length > 0) {
        errors.push(...validationErrors);
        booking.hasErrors = true;
        booking.errors = validationErrors;
      }

      bookings.push(booking);
      currentEvent = null;
    } else if (currentEvent && parsed.key) {
      currentEvent[parsed.key] = parsed.value;
    }
  }

  return {
    bookings,
    errors,
    platform,
    source: filePath,
    rowCount: bookings.length
  };
}
