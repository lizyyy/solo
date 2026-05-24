const { EVENT_STATUS, CONFLICT_TYPES, TIME_UNITS } = require('./constants');
const { 
  normalizeTimezone, 
  convertToTimezone, 
  formatDateTime,
  DateTime 
} = require('./time-utils');

function processCancellations(events, options = {}) {
  const {
    timezone = 'UTC',
    cancellationThresholdMinutes = 60,
    checkRecurrenceExceptions = true
  } = options;
  
  const normalizedTz = normalizeTimezone(timezone);
  
  const results = {
    cancelledEvents: [],
    cancelNotEffective: [],
    processedEvents: [],
    summary: {
      totalCancelled: 0,
      totalNotEffective: 0
    }
  };
  
  const eventsByUid = new Map();
  for (const event of events) {
    if (!eventsByUid.has(event.uid)) {
      eventsByUid.set(event.uid, []);
    }
    eventsByUid.get(event.uid).push(event);
  }
  
  for (const event of events) {
    if (event.status === EVENT_STATUS.CANCELLED) {
      const cancelResult = processCancelledEvent(
        event, 
        eventsByUid, 
        normalizedTz,
        cancellationThresholdMinutes
      );
      
      results.cancelledEvents.push(cancelResult);
      results.summary.totalCancelled++;
      
      if (cancelResult.isNotEffective) {
        results.cancelNotEffective.push(cancelResult);
        results.summary.totalNotEffective++;
      }
    } else {
      results.processedEvents.push(event);
    }
  }
  
  if (checkRecurrenceExceptions) {
    const recurrenceIssues = checkRecurrenceCancellationIssues(events, normalizedTz);
    results.cancelNotEffective.push(...recurrenceIssues);
    results.summary.totalNotEffective += recurrenceIssues.length;
  }
  
  return results;
}

function processCancelledEvent(event, eventsByUid, timezone, cancellationThresholdMinutes) {
  const now = DateTime.utc();
  const localStartTime = convertToTimezone(event.startTime, timezone);
  const localNow = convertToTimezone(now, timezone);
  
  const timeUntilStartMinutes = Math.round(
    (event.startTime.toMillis() - now.toMillis()) / TIME_UNITS.MINUTE
  );
  
  const isPastEvent = event.endTime < now;
  const isImminent = !isPastEvent && timeUntilStartMinutes <= cancellationThresholdMinutes;
  const hasRecurrenceInstances = checkHasRecurrenceInstances(event, eventsByUid);
  const hasActiveInstances = hasRecurrenceInstances && checkHasActiveRecurrenceInstances(event, eventsByUid);
  
  const isNotEffective = (isPastEvent && event.lastModified && 
    event.lastModified > event.endTime) || hasActiveInstances;
  
  const result = {
    type: CONFLICT_TYPES.CANCEL_NOT_EFFECTIVE,
    severity: isPastEvent ? 'low' : isImminent ? 'high' : 'medium',
    event: {
      uid: event.uid,
      summary: event.summary,
      location: event.location,
      organizer: event.organizer ? event.organizer.email : 'N/A',
      startTime: event.startTime,
      endTime: event.endTime,
      localStartTime,
      localEndTime: convertToTimezone(event.endTime, timezone),
      durationMinutes: event.durationMinutes,
      sequence: event.sequence,
      lastModified: event.lastModified,
      created: event.created
    },
    isPastEvent,
    isImminent,
    timeUntilStartMinutes,
    hasRecurrenceInstances,
    hasActiveInstances,
    isNotEffective,
    description: generateCancellationDescription(event, isPastEvent, isImminent, timeUntilStartMinutes),
    explanation: generateCancellationExplanation(
      event, 
      isPastEvent, 
      isImminent, 
      timeUntilStartMinutes, 
      hasActiveInstances,
      timezone
    )
  };
  
  return result;
}

function checkHasRecurrenceInstances(event, eventsByUid) {
  const sameUidEvents = eventsByUid.get(event.uid) || [];
  return sameUidEvents.some(e => e.recurrenceId !== null);
}

function checkHasActiveRecurrenceInstances(event, eventsByUid) {
  const sameUidEvents = eventsByUid.get(event.uid) || [];
  return sameUidEvents.some(e => 
    e.recurrenceId !== null && 
    e.status !== EVENT_STATUS.CANCELLED
  );
}

function checkRecurrenceCancellationIssues(events, timezone) {
  const issues = [];
  const recurringEvents = events.filter(e => e.hasRecurrence && e.status !== EVENT_STATUS.CANCELLED);
  
  for (const recurringEvent of recurringEvents) {
    if (recurringEvent.exdates && recurringEvent.exdates.length > 0) {
      const issue = checkExdateIssues(recurringEvent, timezone);
      if (issue) {
        issues.push(issue);
      }
    }
  }
  
  return issues;
}

function checkExdateIssues(recurringEvent, timezone) {
  const now = DateTime.utc();
  const exdates = recurringEvent.exdates;
  
  const futureExdates = exdates.filter(exdate => exdate > now);
  const pastExdates = exdates.filter(exdate => exdate < now);
  
  const lastModified = recurringEvent.lastModified || recurringEvent.created;
  if (!lastModified) return null;
  
  const issues = [];
  
  for (const exdate of pastExdates) {
    const exdateEnd = exdate.plus({ minutes: recurringEvent.durationMinutes });
    
    if (lastModified > exdateEnd) {
      issues.push({
        exdate: exdate,
        localExdate: convertToTimezone(exdate, timezone),
        issue: 'Cancellation was modified after the occurrence had already passed'
      });
    }
  }
  
  if (issues.length === 0) return null;
  
  return {
    type: CONFLICT_TYPES.CANCEL_NOT_EFFECTIVE,
    subtype: 'recurrence_exdate_issue',
    severity: 'low',
    event: {
      uid: recurringEvent.uid,
      summary: recurringEvent.summary,
      location: recurringEvent.location,
      organizer: recurringEvent.organizer ? recurringEvent.organizer.email : 'N/A',
      startTime: recurringEvent.startTime,
      endTime: recurringEvent.endTime
    },
    exdateIssues: issues,
    exdatesCount: exdates.length,
    futureExdatesCount: futureExdates.length,
    pastExdatesCount: pastExdates.length,
    isNotEffective: true,
    description: `Recurring event has ${issues.length} cancellation timing issues`,
    explanation: generateRecurrenceCancellationExplanation(recurringEvent, issues, timezone)
  };
}

function generateCancellationDescription(event, isPastEvent, isImminent, timeUntilStartMinutes) {
  if (isPastEvent) {
    return 'Cancellation for event that has already ended';
  }
  if (isImminent) {
    return `Last-minute cancellation (${timeUntilStartMinutes} minutes before start)`;
  }
  return 'Cancelled event';
}

function generateCancellationExplanation(event, isPastEvent, isImminent, timeUntilStartMinutes, hasActiveInstances, timezone) {
  const localStart = formatDateTime(event.startTime, timezone, 'full');
  const localEnd = formatDateTime(event.endTime, timezone, 'full');
  const lastModifiedStr = event.lastModified 
    ? formatDateTime(event.lastModified, timezone, 'full')
    : 'N/A';
  
  const explanation = [
    `Event: "${event.summary}"`,
    `Location: ${event.location || 'N/A'}`,
    `Organizer: ${event.organizer ? event.organizer.email : 'N/A'}`,
    `Scheduled Time: ${localStart} - ${localEnd}`,
    `Last Modified: ${lastModifiedStr}`,
    `Sequence: ${event.sequence}`
  ];
  
  if (isPastEvent) {
    explanation.push('⚠️  WARNING: This event has already ended');
    if (event.lastModified && event.lastModified > event.endTime) {
      explanation.push('   Cancellation was recorded AFTER the event ended');
    }
  } else if (isImminent) {
    explanation.push(`⚠️  WARNING: Event starts in ${timeUntilStartMinutes} minutes`);
    explanation.push('   This cancellation may not give attendees enough time');
  }
  
  if (hasActiveInstances) {
    explanation.push('⚠️  WARNING: Some recurrence instances are still active');
  }
  
  return explanation.join('\n');
}

function generateRecurrenceCancellationExplanation(recurringEvent, issues, timezone) {
  const explanation = [
    `Recurring Event: "${recurringEvent.summary}"`,
    `Total EXDATE entries: ${recurringEvent.exdates.length}`,
    `Issues Found: ${issues.length}`
  ];
  
  for (const issue of issues) {
    explanation.push(`- ${formatDateTime(issue.exdate, timezone, 'short')}: ${issue.issue}`);
  }
  
  return explanation.join('\n');
}

function removeCancelledEvents(events) {
  return events.filter(event => event.status !== EVENT_STATUS.CANCELLED);
}

function removePastCancellations(events, thresholdMinutes = 0) {
  const now = DateTime.utc();
  const threshold = now.plus({ minutes: thresholdMinutes });
  
  return events.filter(event => {
    if (event.status !== EVENT_STATUS.CANCELLED) return true;
    return event.startTime > threshold;
  });
}

function getCancellationStats(cancellationResults) {
  const stats = {
    totalEvents: cancellationResults.cancelledEvents.length + cancellationResults.processedEvents.length,
    cancelledCount: cancellationResults.cancelledEvents.length,
    notEffectiveCount: cancellationResults.cancelNotEffective.length,
    activeCount: cancellationResults.processedEvents.length,
    bySeverity: {
      high: 0,
      medium: 0,
      low: 0
    }
  };
  
  for (const cancel of cancellationResults.cancelNotEffective) {
    if (cancel.severity) {
      stats.bySeverity[cancel.severity]++;
    }
  }
  
  return stats;
}

module.exports = {
  processCancellations,
  removeCancelledEvents,
  removePastCancellations,
  getCancellationStats,
  processCancelledEvent,
  checkRecurrenceCancellationIssues
};
