const { CONFLICT_TYPES, EVENT_STATUS, TIME_UNITS } = require('./constants');
const { 
  normalizeTimezone, 
  convertToTimezone, 
  getOverlapMinutes, 
  formatDateTime,
  DateTime 
} = require('./time-utils');

function detectAllConflicts(events, options = {}) {
  const {
    timezone = 'UTC',
    minOverlapMinutes = 0,
    includeBackToBack = false,
    backToBackThresholdMinutes = 0
  } = options;
  
  const normalizedTz = normalizeTimezone(timezone);
  const conflicts = [];
  
  const sortedEvents = [...events].sort((a, b) => a.startTime - b.startTime);
  
  for (let i = 0; i < sortedEvents.length; i++) {
    for (let j = i + 1; j < sortedEvents.length; j++) {
      const eventA = sortedEvents[i];
      const eventB = sortedEvents[j];
      
      if (eventB.startTime >= eventA.endTime && !includeBackToBack) {
        continue;
      }
      
      const conflict = checkPairConflict(
        eventA, 
        eventB, 
        normalizedTz,
        minOverlapMinutes,
        includeBackToBack,
        backToBackThresholdMinutes
      );
      
      if (conflict) {
        conflicts.push(conflict);
      }
    }
  }
  
  const crossDayConflicts = detectCrossDayConflicts(sortedEvents, normalizedTz);
  conflicts.push(...crossDayConflicts);
  
  return conflicts;
}

function checkPairConflict(eventA, eventB, timezone, minOverlapMinutes, includeBackToBack, backToBackThreshold) {
  const overlapMinutes = getOverlapMinutes(
    eventA.startTime, eventA.endTime,
    eventB.startTime, eventB.endTime
  );
  
  if (overlapMinutes > minOverlapMinutes) {
    return createOverlapConflict(eventA, eventB, overlapMinutes, timezone);
  }
  
  if (includeBackToBack && overlapMinutes === 0) {
    const gapMinutes = calculateGapMinutes(eventA, eventB);
    if (gapMinutes <= backToBackThreshold) {
      return createBackToBackConflict(eventA, eventB, gapMinutes, timezone);
    }
  }
  
  return null;
}

function calculateGapMinutes(eventA, eventB) {
  const aEnd = eventA.endTime.toMillis();
  const bStart = eventB.startTime.toMillis();
  
  if (aEnd <= bStart) {
    return Math.round((bStart - aEnd) / TIME_UNITS.MINUTE);
  }
  return 0;
}

function createOverlapConflict(eventA, eventB, overlapMinutes, timezone) {
  const overlapStart = DateTime.max(eventA.startTime, eventB.startTime);
  const overlapEnd = DateTime.min(eventA.endTime, eventB.endTime);
  
  return {
    type: CONFLICT_TYPES.OVERLAP,
    severity: overlapMinutes >= 30 ? 'high' : overlapMinutes >= 10 ? 'medium' : 'low',
    overlapMinutes,
    overlapStart: overlapStart.toUTC(),
    overlapEnd: overlapEnd.toUTC(),
    events: [
      formatEventForConflict(eventA, timezone),
      formatEventForConflict(eventB, timezone)
    ],
    description: `Events overlap by ${overlapMinutes} minutes`,
    explanation: generateOverlapExplanation(eventA, eventB, overlapMinutes, timezone)
  };
}

function createBackToBackConflict(eventA, eventB, gapMinutes, timezone) {
  return {
    type: CONFLICT_TYPES.BACK_TO_BACK,
    severity: 'low',
    gapMinutes,
    events: [
      formatEventForConflict(eventA, timezone),
      formatEventForConflict(eventB, timezone)
    ],
    description: `Back-to-back meetings with ${gapMinutes} minutes gap`,
    explanation: generateBackToBackExplanation(eventA, eventB, gapMinutes, timezone)
  };
}

function detectCrossDayConflicts(events, timezone) {
  const conflicts = [];
  
  for (const event of events) {
    if (event.isCrossDay) {
      const localStart = convertToTimezone(event.startTime, timezone);
      const localEnd = convertToTimezone(event.endTime, timezone);
      
      const dayCount = Math.ceil(
        (localEnd.endOf('day').toMillis() - localStart.startOf('day').toMillis()) / TIME_UNITS.DAY
      );
      
      conflicts.push({
        type: CONFLICT_TYPES.CROSS_DAY,
        severity: 'medium',
        daysSpanned: dayCount,
        event: formatEventForConflict(event, timezone),
        localStart: localStart,
        localEnd: localEnd,
        description: `Event spans ${dayCount} days`,
        explanation: generateCrossDayExplanation(event, dayCount, timezone)
      });
    }
  }
  
  return conflicts;
}

function detectHiddenConflicts(events, options = {}) {
  const {
    timezone = 'UTC',
    checkAllDayOverlap = true
  } = options;
  
  const normalizedTz = normalizeTimezone(timezone);
  const conflicts = [];
  
  const allDayEvents = events.filter(e => e.isAllDay);
  const regularEvents = events.filter(e => !e.isAllDay);
  
  if (checkAllDayOverlap) {
    for (const allDay of allDayEvents) {
      for (const regular of regularEvents) {
        const allDayLocalStart = convertToTimezone(allDay.startTime, normalizedTz).startOf('day');
        const allDayLocalEnd = convertToTimezone(allDay.endTime, normalizedTz).endOf('day');
        const regularLocalStart = convertToTimezone(regular.startTime, normalizedTz);
        
        if (regularLocalStart >= allDayLocalStart && regularLocalStart < allDayLocalEnd) {
          conflicts.push({
            type: CONFLICT_TYPES.HIDDEN_CONFLICT,
            subtype: 'all_day_vs_regular',
            severity: 'medium',
            events: [
              formatEventForConflict(allDay, normalizedTz),
              formatEventForConflict(regular, normalizedTz)
            ],
            description: 'Regular event scheduled during all-day event',
            explanation: generateHiddenConflictExplanation(allDay, regular, normalizedTz)
          });
        }
      }
    }
  }
  
  const timezonesUsed = [...new Set(events.map(e => e.originalStartTz))];
  if (timezonesUsed.length > 1) {
    for (let i = 0; i < events.length; i++) {
      for (let j = i + 1; j < events.length; j++) {
        const eventA = events[i];
        const eventB = events[j];
        
        if (eventA.originalStartTz !== eventB.originalStartTz) {
          const overlapMinutes = getOverlapMinutes(
            eventA.startTime, eventA.endTime,
            eventB.startTime, eventB.endTime
          );
          
          if (overlapMinutes > 0) {
            const exists = conflicts.some(c => 
              c.type === CONFLICT_TYPES.OVERLAP &&
              c.events[0].uid === eventA.uid &&
              c.events[1].uid === eventB.uid
            );
            
            if (!exists) {
              conflicts.push({
                type: CONFLICT_TYPES.HIDDEN_CONFLICT,
                subtype: 'timezone_mismatch_overlap',
                severity: 'high',
                overlapMinutes,
                timezones: [eventA.originalStartTz, eventB.originalStartTz],
                events: [
                  formatEventForConflict(eventA, normalizedTz),
                  formatEventForConflict(eventB, normalizedTz)
                ],
                description: 'Overlap detected due to timezone differences',
                explanation: generateTimezoneMismatchExplanation(eventA, eventB, overlapMinutes, normalizedTz)
              });
            }
          }
        }
      }
    }
  }
  
  return conflicts;
}

function formatEventForConflict(event, timezone) {
  const localStart = convertToTimezone(event.startTime, timezone);
  const localEnd = convertToTimezone(event.endTime, timezone);
  
  return {
    uid: event.uid,
    summary: event.summary,
    location: event.location,
    organizer: event.organizer ? event.organizer.email : 'N/A',
    status: event.status,
    startTime: event.startTime.toUTC(),
    endTime: event.endTime.toUTC(),
    localStartTime: localStart,
    localEndTime: localEnd,
    isAllDay: event.isAllDay,
    isRecurrenceInstance: event.isRecurrenceInstance || false,
    durationMinutes: event.durationMinutes
  };
}

function generateOverlapExplanation(eventA, eventB, overlapMinutes, timezone) {
  const aStart = formatDateTime(eventA.startTime, timezone, 'short');
  const aEnd = formatDateTime(eventA.endTime, timezone, 'time');
  const bStart = formatDateTime(eventB.startTime, timezone, 'short');
  const bEnd = formatDateTime(eventB.endTime, timezone, 'time');
  
  return [
    `Overlap Duration: ${overlapMinutes} minutes`,
    `Event A: "${eventA.summary}" (${aStart} - ${aEnd})`,
    `Event B: "${eventB.summary}" (${bStart} - ${bEnd})`,
    `Location A: ${eventA.location || 'N/A'}`,
    `Location B: ${eventB.location || 'N/A'}`,
    `Organizer A: ${eventA.organizer ? eventA.organizer.email : 'N/A'}`,
    `Organizer B: ${eventB.organizer ? eventB.organizer.email : 'N/A'}`
  ].join('\n');
}

function generateBackToBackExplanation(eventA, eventB, gapMinutes, timezone) {
  const aEnd = formatDateTime(eventA.endTime, timezone, 'short');
  const bStart = formatDateTime(eventB.startTime, timezone, 'short');
  
  return [
    `Gap Duration: ${gapMinutes} minutes`,
    `Event A ends: ${aEnd}`,
    `Event B starts: ${bStart}`,
    `Event A: "${eventA.summary}"`,
    `Event B: "${eventB.summary}"`
  ].join('\n');
}

function generateCrossDayExplanation(event, dayCount, timezone) {
  const localStart = formatDateTime(event.startTime, timezone, 'full');
  const localEnd = formatDateTime(event.endTime, timezone, 'full');
  
  return [
    `Days Spanned: ${dayCount}`,
    `Local Start: ${localStart}`,
    `Local End: ${localEnd}`,
    `Event: "${event.summary}"`,
    `Location: ${event.location || 'N/A'}`,
    `Organizer: ${event.organizer ? event.organizer.email : 'N/A'}`
  ].join('\n');
}

function generateHiddenConflictExplanation(allDayEvent, regularEvent, timezone) {
  const allDayDate = formatDateTime(allDayEvent.startTime, timezone, 'date');
  const regularTime = formatDateTime(regularEvent.startTime, timezone, 'short');
  
  return [
    `All-day event date: ${allDayDate}`,
    `Regular event time: ${regularTime}`,
    `All-day: "${allDayEvent.summary}"`,
    `Regular: "${regularEvent.summary}"`,
    `Note: All-day events may indicate room is reserved for entire day`
  ].join('\n');
}

function generateTimezoneMismatchExplanation(eventA, eventB, overlapMinutes, timezone) {
  return [
    `Overlap Duration: ${overlapMinutes} minutes`,
    `Event A timezone: ${eventA.originalStartTz}`,
    `Event B timezone: ${eventB.originalStartTz}`,
    `Normalized to ${timezone}:`,
    `  Event A: ${formatDateTime(eventA.startTime, timezone, 'short')} - ${formatDateTime(eventA.endTime, timezone, 'time')}`,
    `  Event B: ${formatDateTime(eventB.startTime, timezone, 'short')} - ${formatDateTime(eventB.endTime, timezone, 'time')}`,
    `Event A: "${eventA.summary}"`,
    `Event B: "${eventB.summary}"`
  ].join('\n');
}

function detectConflictsByRoom(eventsByRoom, options = {}) {
  const results = new Map();
  
  for (const [room, roomEvents] of eventsByRoom.entries()) {
    const conflicts = detectAllConflicts(roomEvents, options);
    const hiddenConflicts = detectHiddenConflicts(roomEvents, options);
    
    results.set(room, {
      room,
      eventCount: roomEvents.length,
      conflicts: [...conflicts, ...hiddenConflicts],
      conflictCount: conflicts.length + hiddenConflicts.length,
      hasConflicts: (conflicts.length + hiddenConflicts.length) > 0
    });
  }
  
  return results;
}

function getConflictSummary(conflicts) {
  const summary = {
    total: conflicts.length,
    byType: {},
    bySeverity: {
      high: 0,
      medium: 0,
      low: 0
    }
  };
  
  for (const conflict of conflicts) {
    const type = conflict.type;
    summary.byType[type] = (summary.byType[type] || 0) + 1;
    
    if (conflict.severity) {
      summary.bySeverity[conflict.severity]++;
    }
  }
  
  return summary;
}

module.exports = {
  detectAllConflicts,
  detectHiddenConflicts,
  detectConflictsByRoom,
  detectCrossDayConflicts,
  checkPairConflict,
  getConflictSummary,
  createOverlapConflict,
  formatEventForConflict
};
