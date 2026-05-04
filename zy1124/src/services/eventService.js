const { 
  createEvent, 
  getEventById, 
  listEvents, 
  updateEventStatus,
  getEventsForRetry,
  getFailureStatistics,
  getProviderStatistics,
} = require('../dao/eventDao');
const { 
  createAttempt, 
  updateAttempt, 
  getAttemptsByEventId,
  getLatestAttemptByEventId,
  getFailureReasons,
  getAttemptById,
} = require('../dao/attemptDao');
const { createAuditLog, ACTIONS, getAuditStats, getAuditLogs } = require('../dao/auditDao');
const { EVENT_STATUSES } = require('../db/schema');
const { simulateDownstreamProcessing } = require('./simulatorService');
const { getProviderById } = require('../dao/providerDao');
const config = require('../config');

function calculateNextRetryTime(attemptCount) {
  const { initialDelay, backoffMultiplier } = config.retry;
  const delaySeconds = initialDelay * Math.pow(backoffMultiplier, attemptCount);
  return Math.floor(Date.now() / 1000) + delaySeconds;
}

async function processEvent(event, provider, isReplay = false) {
  const now = Math.floor(Date.now() / 1000);
  const attemptCount = event.attempt_count + 1;
  
  const attempt = await createAttempt({
    event_id: event.id,
    attempt_number: attemptCount,
    status: 'processing',
    is_replay: isReplay ? 1 : 0,
  });
  
  await updateEventStatus(event.id, EVENT_STATUSES.PROCESSING, {
    last_attempt_at: now,
    attempt_count: attemptCount,
  });
  
  const startTime = Date.now();
  
  try {
    const result = await simulateDownstreamProcessing(event, provider);
    const endTime = Date.now();
    const durationMs = endTime - startTime;
    
    if (result.success) {
      await updateAttempt(attempt.id, {
        status: 'success',
        ended_at: Math.floor(Date.now() / 1000),
        duration_ms: durationMs,
      });
      
      await updateEventStatus(event.id, EVENT_STATUSES.SUCCESS, {
        last_attempt_at: Math.floor(Date.now() / 1000),
      });
      
      await createAuditLog(
        isReplay ? ACTIONS.EVENT_REPLAYED : ACTIONS.EVENT_PROCESSED,
        'event',
        event.id,
        { result, attemptCount: attemptCount, isReplay }
      );
      
      const updatedEvent = await getEventById(event.id);
      const updatedAttempt = await getAttemptById(attempt.id);
      
      return { 
        success: true, 
        event: updatedEvent,
        attempt: updatedAttempt,
      };
    } else {
      const maxAttempts = event.max_attempts || config.retry.maxAttempts;
      const shouldRetry = attemptCount < maxAttempts;
      
      await updateAttempt(attempt.id, {
        status: 'failed',
        error_message: result.error,
        ended_at: Math.floor(Date.now() / 1000),
        duration_ms: durationMs,
      });
      
      if (shouldRetry) {
        const nextRetryAt = calculateNextRetryTime(attemptCount);
        
        await updateEventStatus(event.id, EVENT_STATUSES.FAILED_RETRY, {
          last_attempt_at: Math.floor(Date.now() / 1000),
          next_retry_at: nextRetryAt,
        });
        
        await createAuditLog(
          ACTIONS.EVENT_FAILED,
          'event',
          event.id,
          { 
            error: result.error, 
            attemptCount: attemptCount,
            maxAttempts,
            nextRetryAt,
            isReplay,
          }
        );
        
        const updatedEvent = await getEventById(event.id);
        
        return {
          success: false,
          retryable: true,
          nextRetryAt,
          error: result.error,
          event: updatedEvent,
        };
      } else {
        await updateEventStatus(event.id, EVENT_STATUSES.DISCARDED, {
          last_attempt_at: Math.floor(Date.now() / 1000),
        });
        
        await createAuditLog(
          ACTIONS.EVENT_DISCARDED,
          'event',
          event.id,
          { 
            error: result.error, 
            attemptCount: attemptCount,
            maxAttempts,
            isReplay,
          }
        );
        
        const updatedEvent = await getEventById(event.id);
        
        return {
          success: false,
          retryable: false,
          discarded: true,
          error: result.error,
          event: updatedEvent,
        };
      }
    }
  } catch (err) {
    const endTime = Date.now();
    const durationMs = endTime - startTime;
    
    await updateAttempt(attempt.id, {
      status: 'failed',
      error_message: err.message || String(err),
      ended_at: Math.floor(Date.now() / 1000),
      duration_ms: durationMs,
    });
    
    const maxAttempts = event.max_attempts || config.retry.maxAttempts;
    const shouldRetry = attemptCount < maxAttempts;
    
    if (shouldRetry) {
      const nextRetryAt = calculateNextRetryTime(attemptCount);
      
      await updateEventStatus(event.id, EVENT_STATUSES.FAILED_RETRY, {
        last_attempt_at: Math.floor(Date.now() / 1000),
        next_retry_at: nextRetryAt,
      });
      
      await createAuditLog(
        ACTIONS.EVENT_FAILED,
        'event',
        event.id,
        { 
          error: err.message, 
          attemptCount: attemptCount,
          maxAttempts,
          nextRetryAt,
        }
      );
      
      const updatedEvent = await getEventById(event.id);
      
      return {
        success: false,
        retryable: true,
        nextRetryAt,
        error: err.message,
        event: updatedEvent,
      };
    } else {
      await updateEventStatus(event.id, EVENT_STATUSES.DISCARDED, {
        last_attempt_at: Math.floor(Date.now() / 1000),
      });
      
      await createAuditLog(
        ACTIONS.EVENT_DISCARDED,
        'event',
        event.id,
        { 
          error: err.message, 
          attemptCount: attemptCount,
          maxAttempts,
        }
      );
      
      const updatedEvent = await getEventById(event.id);
      
      return {
        success: false,
        retryable: false,
        discarded: true,
        error: err.message,
        event: updatedEvent,
      };
    }
  }
}

async function replayEvent(event, provider) {
  return processEvent(event, provider, true);
}

async function getEventWithAttempts(eventId) {
  const event = await getEventById(eventId);
  if (!event) return null;
  
  const attempts = await getAttemptsByEventId(eventId);
  const auditLogs = await getAuditLogs({
    entity_type: 'event',
    entity_id: eventId,
  });
  
  return {
    ...event,
    attempts,
    auditLogs,
  };
}

async function getStatistics(since, until) {
  const eventStats = await getFailureStatistics(since, until);
  const failureReasons = await getFailureReasons(since, until);
  const auditStats = await getAuditStats(since, until);
  
  return {
    eventStats,
    failureReasons,
    auditStats,
    timeRange: { since, until },
  };
}

async function processPendingRetries() {
  const now = Math.floor(Date.now() / 1000);
  const eventsToRetry = await getEventsForRetry(now);
  
  const results = [];
  
  for (const event of eventsToRetry) {
    const provider = await getProviderById(event.provider_id);
    if (!provider) {
      results.push({
        eventId: event.id,
        error: 'Provider not found',
      });
      continue;
    }
    
    await createAuditLog(
      ACTIONS.EVENT_RETRIED,
      'event',
      event.id,
      { scheduledRetry: true }
    );
    
    const result = await processEvent(event, provider, false);
    results.push({ eventId: event.id, ...result });
  }
  
  return results;
}

module.exports = {
  processEvent,
  replayEvent,
  getEventWithAttempts,
  getStatistics,
  processPendingRetries,
  calculateNextRetryTime,
};
