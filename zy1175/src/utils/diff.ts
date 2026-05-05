import _ from 'lodash';
import {
  TrackingEvent,
  WarehouseSample,
  DiffResult,
  MismatchedEvent,
} from '../types';

export function compareEventsWithWarehouse(
  clientEvents: TrackingEvent[],
  warehouseSamples: WarehouseSample[]
): DiffResult {
  // Create maps for quick lookup
  const clientEventMap = new Map<string, TrackingEvent>();
  const warehouseEventMap = new Map<string, WarehouseSample>();
  
  clientEvents.forEach((event) => {
    if (event.event_id) {
      clientEventMap.set(event.event_id, event);
    }
  });
  
  warehouseSamples.forEach((sample) => {
    if (sample.event_id) {
      warehouseEventMap.set(sample.event_id, sample);
    }
  });
  
  // Find events in client only
  const inClientOnly: string[] = [];
  clientEventMap.forEach((_, id) => {
    if (!warehouseEventMap.has(id)) {
      inClientOnly.push(id);
    }
  });
  
  // Find events in warehouse only
  const inWarehouseOnly: string[] = [];
  warehouseEventMap.forEach((_, id) => {
    if (!clientEventMap.has(id)) {
      inWarehouseOnly.push(id);
    }
  });
  
  // Find events in both
  const both: string[] = [];
  const mismatched: MismatchedEvent[] = [];
  
  clientEventMap.forEach((clientEvent, id) => {
    if (warehouseEventMap.has(id)) {
      both.push(id);
      
      const warehouseEvent = warehouseEventMap.get(id)!;
      const differences = compareEventFields(clientEvent, warehouseEvent);
      
      if (differences.length > 0) {
        mismatched.push({
          event_id: id,
          client_event: clientEvent,
          warehouse_event: warehouseEvent,
          differences,
        });
      }
    }
  });
  
  return {
    category: 'event_comparison',
    in_client_only: inClientOnly,
    in_warehouse_only: inWarehouseOnly,
    both,
    mismatched,
  };
}

function compareEventFields(
  clientEvent: TrackingEvent,
  warehouseEvent: WarehouseSample
): string[] {
  const differences: string[] = [];
  
  // Compare common fields
  const fieldsToCompare = [
    'event_name',
    'timestamp',
    'user_id',
    'session_id',
    'app_version',
  ];
  
  fieldsToCompare.forEach((field) => {
    const clientValue = clientEvent[field as keyof TrackingEvent];
    const warehouseValue = warehouseEvent[field as keyof WarehouseSample];
    
    if (clientValue !== warehouseValue) {
      differences.push(
        `${field}: client="${clientValue}" vs warehouse="${warehouseValue}"`
      );
    }
  });
  
  return differences;
}

export function compareEventCounts(
  clientEvents: TrackingEvent[],
  warehouseSamples: WarehouseSample[]
): { clientCount: number; warehouseCount: number; difference: number; differencePercent: number } {
  const clientCount = clientEvents.length;
  const warehouseCount = warehouseSamples.length;
  const difference = clientCount - warehouseCount;
  const differencePercent = clientCount > 0 
    ? (difference / clientCount) * 100 
    : 0;
  
  return {
    clientCount,
    warehouseCount,
    difference,
    differencePercent,
  };
}

export function compareEventTypes(
  clientEvents: TrackingEvent[],
  warehouseSamples: WarehouseSample[]
): {
  clientEventCounts: Record<string, number>;
  warehouseEventCounts: Record<string, number>;
  differences: Array<{
    event_name: string;
    client_count: number;
    warehouse_count: number;
    difference: number;
    difference_percent: number;
  }>;
} {
  const clientEventCounts = _.countBy(clientEvents, 'event_name');
  const warehouseEventCounts = _.countBy(warehouseSamples, 'event_name');
  
  const allEventNames = new Set([
    ...Object.keys(clientEventCounts),
    ...Object.keys(warehouseEventCounts),
  ]);
  
  const differences: Array<{
    event_name: string;
    client_count: number;
    warehouse_count: number;
    difference: number;
    difference_percent: number;
  }> = [];
  
  allEventNames.forEach((eventName) => {
    const clientCount = clientEventCounts[eventName] || 0;
    const warehouseCount = warehouseEventCounts[eventName] || 0;
    const difference = clientCount - warehouseCount;
    const differencePercent = clientCount > 0 
      ? (difference / clientCount) * 100 
      : 0;
    
    if (difference !== 0) {
      differences.push({
        event_name: eventName,
        client_count: clientCount,
        warehouse_count: warehouseCount,
        difference,
        difference_percent: differencePercent,
      });
    }
  });
  
  return {
    clientEventCounts,
    warehouseEventCounts,
    differences,
  };
}

export function runAllDiffChecks(
  clientEvents: TrackingEvent[],
  warehouseSamples: WarehouseSample[]
): DiffResult[] {
  const results: DiffResult[] = [];
  
  // Event-level comparison
  const eventComparison = compareEventsWithWarehouse(clientEvents, warehouseSamples);
  results.push(eventComparison);
  
  // Count comparison
  const countComparison = compareEventCounts(clientEvents, warehouseSamples);
  results.push({
    category: 'count_comparison',
    in_client_only: [],
    in_warehouse_only: [],
    both: [],
    mismatched: [],
  });
  
  // Event type comparison
  const typeComparison = compareEventTypes(clientEvents, warehouseSamples);
  results.push({
    category: 'type_comparison',
    in_client_only: [],
    in_warehouse_only: [],
    both: [],
    mismatched: [],
  });
  
  return results;
}
