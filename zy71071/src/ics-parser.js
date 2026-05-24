const fs = require('fs');
const ical = require('ical.js');
const { RRule, RRuleSet, rrulestr } = require('rrule');
const { 
  normalizeTimezone, 
  parseICalDate, 
  convertToTimezone, 
  isAllDayEvent, 
  isCrossDayEvent,
  DateTime 
} = require('./time-utils');
const { EVENT_STATUS, TIME_UNITS } = require('./constants');

function parseICSFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`ICS file not found: ${filePath}`);
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  return parseICSContent(content);
}

function parseICSContent(content) {
  try {
    const jCal = ical.parse(content);
    const component = new ical.Component(jCal);
    return {
      calendar: parseCalendar(component),
      events: parseEvents(component),
      timezones: parseTimezones(component)
    };
  } catch (error) {
    throw new Error(`Failed to parse ICS content: ${error.message}`);
  }
}

function getVCalendar(component) {
  const vcalendar = component.getFirstSubcomponent('vcalendar');
  return vcalendar || component;
}

function parseICalTimeObject(icalTime, timezone, isAllDay = false) {
  if (!icalTime) return null;
  
  if (typeof icalTime === 'string') {
    return parseICalDate(icalTime, timezone, isAllDay);
  }
  
  if (icalTime.isDate || isAllDay) {
    return DateTime.fromObject({
      year: icalTime.year,
      month: icalTime.month,
      day: icalTime.day,
      hour: 0,
      minute: 0,
      second: 0
    }, { zone: 'UTC' }).startOf('day');
  }
  
  const normalizedTz = normalizeTimezone(timezone);
  
  return DateTime.fromObject({
    year: icalTime.year,
    month: icalTime.month,
    day: icalTime.day,
    hour: icalTime.hour || 0,
    minute: icalTime.minute || 0,
    second: icalTime.second || 0
  }, { zone: normalizedTz }).toUTC();
}

function parseCalendar(component) {
  const vcalendar = getVCalendar(component);
  
  return {
    version: vcalendar.getFirstPropertyValue('version'),
    prodId: vcalendar.getFirstPropertyValue('prodid'),
    name: vcalendar.getFirstPropertyValue('x-wr-calname') || '',
    timezone: vcalendar.getFirstPropertyValue('x-wr-timezone') || 'UTC'
  };
}

function parseTimezones(component) {
  const timezones = [];
  const vcalendar = getVCalendar(component);
  
  const vtimezones = vcalendar.getAllSubcomponents('vtimezone');
  for (const vtz of vtimezones) {
    const tzid = vtz.getFirstPropertyValue('tzid');
    timezones.push({
      tzid,
      normalized: normalizeTimezone(tzid)
    });
  }
  
  return timezones;
}

function parseEvents(component) {
  const events = [];
  const vcalendar = getVCalendar(component);
  
  const vevents = vcalendar.getAllSubcomponents('vevent');
  const defaultTz = vcalendar.getFirstPropertyValue('x-wr-timezone') || 'UTC';
  
  for (const vevent of vevents) {
    const event = parseSingleEvent(vevent, defaultTz);
    if (event) {
      events.push(event);
    }
  }
  
  return events;
}

function parseSingleEvent(vevent, defaultTz = 'UTC') {
  const uid = vevent.getFirstPropertyValue('uid');
  if (!uid) return null;
  
  const summary = vevent.getFirstPropertyValue('summary') || '(No Title)';
  const description = vevent.getFirstPropertyValue('description') || '';
  const location = vevent.getFirstPropertyValue('location') || '';
  const status = vevent.getFirstPropertyValue('status') || EVENT_STATUS.TENTATIVE;
  const sequence = vevent.getFirstPropertyValue('sequence') || 0;
  const created = vevent.getFirstPropertyValue('created');
  const lastModified = vevent.getFirstPropertyValue('last-modified');
  const organizer = parseOrganizer(vevent);
  const attendees = parseAttendees(vevent);
  
  const dtStartProp = vevent.getFirstProperty('dtstart');
  const dtEndProp = vevent.getFirstProperty('dtend');
  
  if (!dtStartProp) return null;
  
  const startTz = dtStartProp.getParameter('tzid') || defaultTz;
  const endTz = dtEndProp ? (dtEndProp.getParameter('tzid') || defaultTz) : startTz;
  
  const dtStartValue = dtStartProp.getFirstValue();
  const dtEndValue = dtEndProp ? dtEndProp.getFirstValue() : null;
  
  const isAllDay = dtStartValue.isDate || (dtEndValue && dtEndValue.isDate);
  
  const startTime = parseICalTimeObject(dtStartValue, startTz, isAllDay);
  
  let endTime;
  if (dtEndValue) {
    endTime = parseICalTimeObject(dtEndValue, endTz, isAllDay);
  } else {
    endTime = startTime.plus({ hours: 1 });
  }
  
  const rrule = parseRecurrenceRule(vevent, startTime, isAllDay);
  const exdates = parseExdates(vevent, startTz);
  
  const durationMinutes = Math.round((endTime.toMillis() - startTime.toMillis()) / TIME_UNITS.MINUTE);
  
  const isCrossDay = isCrossDayEvent(startTime, endTime, defaultTz);
  const actuallyAllDay = isAllDay || isAllDayEvent(startTime, endTime);
  
  return {
    uid,
    summary,
    description,
    location,
    status,
    sequence: parseInt(sequence, 10),
    organizer,
    attendees,
    startTime: startTime.toUTC(),
    endTime: endTime.toUTC(),
    originalStartTz: normalizeTimezone(startTz),
    originalEndTz: normalizeTimezone(endTz),
    isAllDay: actuallyAllDay,
    isCrossDay,
    durationMinutes,
    rrule,
    hasRecurrence: !!rrule,
    exdates,
    exdatesCount: exdates.length,
    created: created ? parseICalTimeObject(created, 'UTC', false) : null,
    lastModified: lastModified ? parseICalTimeObject(lastModified, 'UTC', false) : null,
    recurrenceId: parseRecurrenceId(vevent, startTz),
    raw: {
      dtstart: dtStartProp.toString(),
      dtend: dtEndProp ? dtEndProp.toString() : null
    }
  };
}

function parseOrganizer(vevent) {
  const organizerProp = vevent.getFirstProperty('organizer');
  if (!organizerProp) return null;
  
  const value = organizerProp.getFirstValue();
  const cn = organizerProp.getParameter('cn');
  
  return {
    email: value.replace('mailto:', ''),
    name: cn || '',
    raw: value
  };
}

function parseAttendees(vevent) {
  const attendees = [];
  const attendeeProps = vevent.getAllProperties('attendee');
  
  for (const prop of attendeeProps) {
    const value = prop.getFirstValue();
    const cn = prop.getParameter('cn');
    const role = prop.getParameter('role');
    const partstat = prop.getParameter('partstat');
    const rsvp = prop.getParameter('rsvp');
    
    attendees.push({
      email: value.replace('mailto:', ''),
      name: cn || '',
      role: role || 'REQ-PARTICIPANT',
      status: partstat || 'NEEDS-ACTION',
      rsvp: rsvp === 'TRUE',
      raw: value
    });
  }
  
  return attendees;
}

function parseRecurrenceRule(vevent, startTime, isAllDay) {
  const rruleProp = vevent.getFirstProperty('rrule');
  if (!rruleProp) return null;
  
  try {
    const rruleStr = rruleProp.toString();
    const rule = rrulestr(rruleStr, {
      dtstart: startTime.toJSDate(),
      forceset: true
    });
    
    return {
      raw: rruleStr,
      freq: rruleProp.getFirstValue(),
      rule
    };
  } catch (error) {
    return {
      raw: rruleProp.toString(),
      error: error.message
    };
  }
}

function parseExdates(vevent, timezone) {
  const exdates = [];
  const exdateProps = vevent.getAllProperties('exdate');
  
  for (const prop of exdateProps) {
    const tzid = prop.getParameter('tzid') || timezone;
    const values = [];
    try {
      const val = prop.getFirstValue();
      if (Array.isArray(val)) {
        values.push(...val);
      } else {
        values.push(val);
      }
    } catch (e) {
      continue;
    }
    
    for (const value of values) {
      const parsed = parseICalTimeObject(value, tzid, true);
      if (parsed) {
        exdates.push(parsed.toUTC());
      }
    }
  }
  
  return exdates;
}

function parseRecurrenceId(vevent, timezone) {
  const recIdProp = vevent.getFirstProperty('recurrence-id');
  if (!recIdProp) return null;
  
  const tzid = recIdProp.getParameter('tzid') || timezone;
  const value = recIdProp.getFirstValue();
  
  return parseICalTimeObject(value, tzid, false).toUTC();
}

function expandRecurringEvents(event, startRange, endRange) {
  if (!event.rrule || !event.rrule.rule) {
    return [event];
  }
  
  const expanded = [];
  const rule = event.rrule.rule;
  
  const rangeStart = DateTime.isDateTime(startRange) ? startRange.toJSDate() : new Date(startRange);
  const rangeEnd = DateTime.isDateTime(endRange) ? endRange.toJSDate() : new Date(endRange);
  
  const occurrences = rule.between(rangeStart, rangeEnd, true);
  
  for (const occurrence of occurrences) {
    const occurrenceStart = DateTime.fromJSDate(occurrence).toUTC();
    const occurrenceEnd = occurrenceStart.plus({ minutes: event.durationMinutes });
    
    const isExcluded = event.exdates.some(exdate => {
      const exdateStart = exdate.startOf('day');
      const occDate = occurrenceStart.startOf('day');
      return exdateStart.equals(occDate);
    });
    
    if (isExcluded) continue;
    
    expanded.push({
      ...event,
      startTime: occurrenceStart,
      endTime: occurrenceEnd,
      isRecurrenceInstance: true,
      recurrenceOriginalUid: event.uid,
      recurrenceDate: occurrenceStart
    });
  }
  
  return expanded;
}

function filterEventsByTimeRange(events, startRange, endRange, timezone = 'UTC') {
  const normalizedTz = normalizeTimezone(timezone);
  const rangeStart = convertToTimezone(
    DateTime.isDateTime(startRange) ? startRange : DateTime.fromISO(startRange),
    normalizedTz
  ).toUTC();
  const rangeEnd = convertToTimezone(
    DateTime.isDateTime(endRange) ? endRange : DateTime.fromISO(endRange),
    normalizedTz
  ).toUTC();
  
  return events.filter(event => {
    return event.startTime < rangeEnd && event.endTime > rangeStart;
  });
}

function filterEventsByRoom(events, roomName) {
  if (!roomName) return events;
  
  const searchLower = roomName.toLowerCase();
  return events.filter(event => {
    return event.location && event.location.toLowerCase().includes(searchLower);
  });
}

function filterEventsByOrganizer(events, organizerEmail) {
  if (!organizerEmail) return events;
  
  const searchLower = organizerEmail.toLowerCase();
  return events.filter(event => {
    return event.organizer && 
           (event.organizer.email.toLowerCase().includes(searchLower) ||
            event.organizer.name.toLowerCase().includes(searchLower));
  });
}

function groupEventsByRoom(events) {
  const groups = new Map();
  
  for (const event of events) {
    const room = event.location || '(Unknown Room)';
    if (!groups.has(room)) {
      groups.set(room, []);
    }
    groups.get(room).push(event);
  }
  
  return groups;
}

function groupEventsByDate(events, timezone = 'UTC') {
  const groups = new Map();
  const normalizedTz = normalizeTimezone(timezone);
  
  for (const event of events) {
    const localStart = convertToTimezone(event.startTime, normalizedTz);
    const dateKey = localStart.toFormat('yyyy-MM-dd');
    
    if (!groups.has(dateKey)) {
      groups.set(dateKey, []);
    }
    groups.get(dateKey).push(event);
  }
  
  return new Map([...groups.entries()].sort());
}

module.exports = {
  parseICSFile,
  parseICSContent,
  expandRecurringEvents,
  filterEventsByTimeRange,
  filterEventsByRoom,
  filterEventsByOrganizer,
  groupEventsByRoom,
  groupEventsByDate,
  parseSingleEvent
};
