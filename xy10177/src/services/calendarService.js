const db = require('../db');
const { format, parseISO } = require('date-fns');

function formatICSDate(dateStr) {
  const date = parseISO(dateStr.replace(' ', 'T'));
  return format(date, 'yyyyMMdd\'T\'HHmmss');
}

function escapeICSString(str) {
  if (!str) return '';
  return str
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/\n/g, '\\n');
}

function generateICS(meeting, resources = []) {
  const now = formatICSDate(new Date().toISOString());
  const dtStart = formatICSDate(meeting.start_time);
  const dtEnd = formatICSDate(meeting.end_time);

  const resourceNames = resources
    .map(r => `${r.resource_type}: ${r.name}`)
    .join('; ');

  const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Meeting Room System//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
UID:${meeting.id}@meeting-room
DTSTAMP:${now}
DTSTART:${dtStart}
DTEND:${dtEnd}
SUMMARY:${escapeICSString(meeting.title)}
DESCRIPTION:${escapeICSString(meeting.organizer + (resourceNames ? ' | ' + resourceNames : ''))}
ORGANIZER:CN=${escapeICSString(meeting.organizer)}
STATUS:${meeting.status.toUpperCase()}
END:VEVENT
END:VCALENDAR`;

  return icsContent;
}

function generateMeetingICS(meetingId) {
  const meeting = db.prepare('SELECT * FROM meetings WHERE id = ?').get(meetingId);
  if (!meeting) return null;

  const bookings = db.prepare(`
    SELECT b.resource_type, b.resource_id,
      CASE b.resource_type
        WHEN 'room' THEN mr.name
        WHEN 'device' THEN d.name
        WHEN 'catering' THEN c.name
      END as name
    FROM bookings b
    LEFT JOIN meeting_rooms mr ON b.resource_type = 'room' AND b.resource_id = mr.id
    LEFT JOIN devices d ON b.resource_type = 'device' AND b.resource_id = d.id
    LEFT JOIN catering c ON b.resource_type = 'catering' AND b.resource_id = c.id
    WHERE b.meeting_id = ? AND b.status = 'active'
  `).all(meetingId);

  return generateICS(meeting, bookings);
}

function generateCalendarICS(startDate = null, endDate = null) {
  let query = 'SELECT * FROM meetings WHERE status = ?';
  const params = ['scheduled'];

  if (startDate) {
    query += ' AND start_time >= ?';
    params.push(startDate);
  }
  if (endDate) {
    query += ' AND end_time <= ?';
    params.push(endDate);
  }

  query += ' ORDER BY start_time ASC';

  const meetings = db.prepare(query).all(...params);
  if (meetings.length === 0) return null;

  const now = formatICSDate(new Date().toISOString());
  
  let icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Meeting Room System//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
`;

  for (const meeting of meetings) {
    const bookings = db.prepare(`
      SELECT b.resource_type,
        CASE b.resource_type
          WHEN 'room' THEN mr.name
          WHEN 'device' THEN d.name
          WHEN 'catering' THEN c.name
        END as name
      FROM bookings b
      LEFT JOIN meeting_rooms mr ON b.resource_type = 'room' AND b.resource_id = mr.id
      LEFT JOIN devices d ON b.resource_type = 'device' AND b.resource_id = d.id
      LEFT JOIN catering c ON b.resource_type = 'catering' AND b.resource_id = c.id
      WHERE b.meeting_id = ? AND b.status = 'active'
    `).all(meeting.id);

    const resourceNames = bookings
      .map(b => `${b.resource_type}: ${b.name}`)
      .join('; ');

    const dtStart = formatICSDate(meeting.start_time);
    const dtEnd = formatICSDate(meeting.end_time);

    icsContent += `BEGIN:VEVENT
UID:${meeting.id}@meeting-room
DTSTAMP:${now}
DTSTART:${dtStart}
DTEND:${dtEnd}
SUMMARY:${escapeICSString(meeting.title)}
DESCRIPTION:${escapeICSString(meeting.organizer + (resourceNames ? ' | ' + resourceNames : ''))}
ORGANIZER:CN=${escapeICSString(meeting.organizer)}
STATUS:${meeting.status.toUpperCase()}
END:VEVENT
`;
  }

  icsContent += 'END:VCALENDAR';
  return icsContent;
}

module.exports = {
  generateICS,
  generateMeetingICS,
  generateCalendarICS,
};
