import _ from 'lodash';
import {
  TrackingSchema,
  TrackingEvent,
  EventSchema,
  FieldDefinition,
  CheckResult,
  ReleaseChange,
} from '../types';

export function checkDuplicateEventIds(events: TrackingEvent[]): CheckResult[] {
  const results: CheckResult[] = [];
  const eventIdCounts: Record<string, number> = {};
  
  events.forEach((event) => {
    if (event.event_id) {
      eventIdCounts[event.event_id] = (eventIdCounts[event.event_id] || 0) + 1;
    }
  });
  
  for (const [eventId, count] of Object.entries(eventIdCounts)) {
    if (count > 1) {
      const duplicateEvents = events.filter(e => e.event_id === eventId);
      results.push({
        type: 'error',
        category: 'duplicate_event_id',
        message: `Duplicate event_id: ${eventId} (appears ${count} times)`,
        details: {
          count,
          events: duplicateEvents.map(e => ({
            event_name: e.event_name,
            timestamp: e.timestamp,
            user_id: e.user_id,
          })),
        },
        event_id: eventId,
        timestamp: duplicateEvents[0]?.timestamp,
      });
    }
  }
  
  return results;
}

export function checkMissingRequiredFields(
  events: TrackingEvent[],
  schema: TrackingSchema | null
): CheckResult[] {
  const results: CheckResult[] = [];
  
  if (!schema) {
    results.push({
      type: 'warning',
      category: 'schema_missing',
      message: 'No tracking schema loaded. Skipping required field validation.',
    });
    return results;
  }
  
  events.forEach((event, index) => {
    // Check common required fields
    const commonRequiredFields = schema.commonFields
      .filter(f => f.required)
      .map(f => f.name);
    
    commonRequiredFields.forEach((fieldName) => {
      if (!(fieldName in event) || event[fieldName] === undefined || event[fieldName] === null) {
        results.push({
          type: 'error',
          category: 'missing_required_field',
          message: `Missing required common field: ${fieldName} in event at index ${index}`,
          details: {
            field: fieldName,
            event_index: index,
          },
          event_id: event.event_id,
          event_name: event.event_name,
          timestamp: event.timestamp,
        });
      }
    });
    
    // Check event-specific required fields
    const eventSchema = schema.events.find(e => e.name === event.event_name);
    if (eventSchema) {
      eventSchema.required.forEach((fieldName) => {
        const properties = event.properties || {};
        if (!(fieldName in properties) || properties[fieldName] === undefined || properties[fieldName] === null) {
          results.push({
            type: 'error',
            category: 'missing_required_field',
            message: `Missing required field "${fieldName}" for event "${event.event_name}"`,
            details: {
              field: fieldName,
              event_name: event.event_name,
              event_index: index,
            },
            event_id: event.event_id,
            event_name: event.event_name,
            timestamp: event.timestamp,
          });
        }
      });
    }
  });
  
  return results;
}

export function checkFieldTypes(
  events: TrackingEvent[],
  schema: TrackingSchema | null
): CheckResult[] {
  const results: CheckResult[] = [];
  
  if (!schema) {
    return results;
  }
  
  events.forEach((event, index) => {
    const eventSchema = schema.events.find(e => e.name === event.event_name);
    if (!eventSchema) {
      return;
    }
    
    // Check event-specific fields
    const properties = event.properties || {};
    
    eventSchema.fields.forEach((fieldDef) => {
      const value = properties[fieldDef.name];
      if (value === undefined || value === null) {
        return;
      }
      
      const expectedType = fieldDef.type;
      let actualType: string = typeof value;
      
      if (Array.isArray(value)) {
        actualType = 'array';
      }
      
      if (actualType !== expectedType) {
        results.push({
          type: 'error',
          category: 'field_type_mismatch',
          message: `Field type mismatch for "${fieldDef.name}" in "${event.event_name}": expected ${expectedType}, got ${actualType}`,
          details: {
            field: fieldDef.name,
            expected_type: expectedType,
            actual_type: actualType,
            value: value,
            event_name: event.event_name,
          },
          event_id: event.event_id,
          event_name: event.event_name,
          timestamp: event.timestamp,
        });
      }
    });
  });
  
  return results;
}

export function checkEnumValues(
  events: TrackingEvent[],
  schema: TrackingSchema | null
): CheckResult[] {
  const results: CheckResult[] = [];
  
  if (!schema) {
    return results;
  }
  
  events.forEach((event, index) => {
    const eventSchema = schema.events.find(e => e.name === event.event_name);
    if (!eventSchema) {
      return;
    }
    
    const properties = event.properties || {};
    
    eventSchema.fields.forEach((fieldDef) => {
      if (!fieldDef.enum || fieldDef.enum.length === 0) {
        return;
      }
      
      const value = properties[fieldDef.name];
      if (value === undefined || value === null) {
        return;
      }
      
      if (!fieldDef.enum.includes(value)) {
        results.push({
          type: 'error',
          category: 'enum_value_mismatch',
          message: `Invalid enum value for "${fieldDef.name}" in "${event.event_name}": "${value}" not in [${fieldDef.enum.join(', ')}]`,
          details: {
            field: fieldDef.name,
            value: value,
            allowed_values: fieldDef.enum,
            event_name: event.event_name,
          },
          event_id: event.event_id,
          event_name: event.event_name,
          timestamp: event.timestamp,
        });
      }
    });
  });
  
  return results;
}

export function checkUnknownEvents(
  events: TrackingEvent[],
  schema: TrackingSchema | null
): CheckResult[] {
  const results: CheckResult[] = [];
  
  if (!schema) {
    return results;
  }
  
  const knownEventNames = new Set(schema.events.map(e => e.name));
  
  events.forEach((event, index) => {
    if (!knownEventNames.has(event.event_name)) {
      results.push({
        type: 'warning',
        category: 'unknown_event',
        message: `Unknown event: "${event.event_name}" - not defined in tracking schema`,
        details: {
          event_name: event.event_name,
          event_index: index,
        },
        event_id: event.event_id,
        event_name: event.event_name,
        timestamp: event.timestamp,
      });
    }
  });
  
  return results;
}

export function checkVersionChanges(
  events: TrackingEvent[],
  schema: TrackingSchema | null,
  releaseChanges: ReleaseChange[]
): CheckResult[] {
  const results: CheckResult[] = [];
  
  if (releaseChanges.length === 0) {
    return results;
  }
  
  // Get all renamed events
  const renamedEvents: Record<string, string> = {};
  const removedEvents: string[] = [];
  
  releaseChanges.forEach((release) => {
    release.changes.forEach((change) => {
      if (change.type === 'rename' && change.from && change.to) {
        renamedEvents[change.from] = change.to;
      }
      if (change.type === 'remove' && change.event) {
        removedEvents.push(change.event);
      }
    });
  });
  
  events.forEach((event, index) => {
    // Check for old event names that should be renamed
    if (renamedEvents[event.event_name]) {
      const newName = renamedEvents[event.event_name];
      results.push({
        type: 'warning',
        category: 'old_event_name',
        message: `Using deprecated event name "${event.event_name}". Should be renamed to "${newName}"`,
        details: {
          old_name: event.event_name,
          new_name: newName,
        },
        event_id: event.event_id,
        event_name: event.event_name,
        timestamp: event.timestamp,
      });
    }
    
    // Check for removed events
    if (removedEvents.includes(event.event_name)) {
      results.push({
        type: 'error',
        category: 'removed_event',
        message: `Event "${event.event_name}" has been removed in a previous release`,
        details: {
          event_name: event.event_name,
        },
        event_id: event.event_id,
        event_name: event.event_name,
        timestamp: event.timestamp,
      });
    }
  });
  
  return results;
}

export function runAllChecks(
  events: TrackingEvent[],
  schema: TrackingSchema | null,
  releaseChanges: ReleaseChange[]
): CheckResult[] {
  const results: CheckResult[] = [];
  
  results.push(...checkDuplicateEventIds(events));
  results.push(...checkMissingRequiredFields(events, schema));
  results.push(...checkFieldTypes(events, schema));
  results.push(...checkEnumValues(events, schema));
  results.push(...checkUnknownEvents(events, schema));
  results.push(...checkVersionChanges(events, schema, releaseChanges));
  
  return _.sortBy(results, (r) => {
    const severityOrder = { error: 0, warning: 1, info: 2 };
    return severityOrder[r.type as keyof typeof severityOrder];
  });
}
