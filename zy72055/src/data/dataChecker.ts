import type { InspectionRecord, Anomaly, DataCheckResult, Position } from '../types';

function generateId(): string {
  return 'ANO-' + Math.random().toString(36).substr(2, 9).toUpperCase();
}

function normalizeName(name: string): string {
  return name
    .replace(/[-_\s]/g, '')
    .replace(/[（(][^)）]*[)）]/g, '')
    .toLowerCase();
}

function sortedNameChars(name: string): string {
  const normalized = normalizeName(name);
  return normalized.split('').sort().join('');
}

function nameSimilarity(s1: string, s2: string): number {
  const n1 = normalizeName(s1);
  const n2 = normalizeName(s2);
  if (n1 === n2) return 1.0;
  
  const sorted1 = sortedNameChars(s1);
  const sorted2 = sortedNameChars(s2);
  if (sorted1 === sorted2) return 0.95;
  
  return stringSimilarity(n1, n2);
}

function calculateDistance(p1: Position, p2: Position): number {
  return Math.sqrt(
    Math.pow(p1.x - p2.x, 2) +
    Math.pow(p1.y - p2.y, 2) +
    Math.pow(p1.z - p2.z, 2)
  );
}

function stringSimilarity(s1: string, s2: string): number {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  
  if (longer.length === 0) return 1.0;
  
  const costs: number[] = [];
  for (let i = 0; i <= shorter.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= longer.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (shorter.charAt(i - 1) !== longer.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[longer.length] = lastValue;
  }
  
  return (longer.length - costs[longer.length]) / longer.length;
}

export function detectCoordinateOffset(records: InspectionRecord[]): Array<{ anomaly: Anomaly; distance: number }> {
  const results: Array<{ anomaly: Anomaly; distance: number }> = [];
  const nameGroups = new Map<string, InspectionRecord[]>();
  
  records.forEach(record => {
    const normalized = normalizeName(record.deviceName);
    if (!nameGroups.has(normalized)) {
      nameGroups.set(normalized, []);
    }
    nameGroups.get(normalized)!.push(record);
  });
  
  nameGroups.forEach(group => {
    if (group.length >= 2) {
      const reported = group[0];
      const actual = group[1];
      const distance = calculateDistance(
        { x: reported.x, y: reported.y, z: reported.z },
        { x: actual.x, y: actual.y, z: actual.z }
      );
      
      if (distance > 1) {
        const anomaly: Anomaly = {
          id: generateId(),
          recordId: reported.id,
          type: 'coordinate_offset',
          severity: distance > 5 ? 'critical' : 'warning',
          status: 'pending',
          reportedPosition: { x: reported.x, y: reported.y, z: reported.z },
          actualPosition: { x: actual.x, y: actual.y, z: actual.z },
          offsetDistance: distance,
          isCrossFloor: false,
          relatedAnomalyIds: [],
          notes: [],
        };
        results.push({ anomaly, distance });
      }
    }
  });
  
  return results;
}

export function detectDuplicateNames(records: InspectionRecord[]): Array<{ names: string[]; recordIds: string[]; anomalyIds: string[] }> {
  const results: Array<{ names: string[]; recordIds: string[]; anomalyIds: string[] }> = [];
  const processed = new Set<string>();
  
  for (let i = 0; i < records.length; i++) {
    if (processed.has(records[i].id)) continue;
    
    const group: Array<{ record: InspectionRecord; originalName: string }> = [
      { record: records[i], originalName: records[i].deviceName }
    ];
    
    for (let j = i + 1; j < records.length; j++) {
      if (processed.has(records[j].id)) continue;
      
      const sim = nameSimilarity(records[i].deviceName, records[j].deviceName);
      if (sim >= 0.9) {
        group.push({ record: records[j], originalName: records[j].deviceName });
      }
    }
    
    const uniqueNames = [...new Set(group.map(g => g.originalName))];
    if (uniqueNames.length > 1) {
      const anomalyIds = group.map(() => generateId());
      const recordIds = group.map(g => g.record.id);
      results.push({ names: uniqueNames, recordIds, anomalyIds });
      group.forEach(g => processed.add(g.record.id));
    } else {
      processed.add(records[i].id);
    }
  }
  
  return results;
}

export function detectMissingPhotos(records: InspectionRecord[]): Anomaly[] {
  return records
    .filter(r => !r.photoUrl)
    .map(record => ({
      id: generateId(),
      recordId: record.id,
      type: 'missing_photo' as const,
      severity: 'warning' as const,
      status: 'pending' as const,
      reportedPosition: { x: record.x, y: record.y, z: record.z },
      isCrossFloor: false,
      relatedAnomalyIds: [],
      notes: [],
    }));
}

export function detectCrossFloor(records: InspectionRecord[]): Anomaly[] {
  return records
    .filter(r => {
      if (r.description.includes('跨楼层') || r.description.includes('多层')) return true;
      if (r.anomalyType.includes('跨楼层') || r.anomalyType.includes('跨层')) return true;
      const floorMatch = r.description.match(/[0-9]+层/g);
      if (floorMatch && floorMatch.length >= 2) return true;
      return false;
    })
    .map(record => ({
      id: generateId(),
      recordId: record.id,
      type: 'cross_floor' as const,
      severity: 'critical' as const,
      status: 'pending' as const,
      reportedPosition: { x: record.x, y: record.y, z: record.z },
      isCrossFloor: true,
      relatedFloor: ['1层', '2层'],
      relatedAnomalyIds: [],
      notes: [],
    }));
}

export function detectNullValues(records: InspectionRecord[]): Array<{ recordId: string; field: string }> {
  const results: Array<{ recordId: string; field: string }> = [];
  const fieldsToCheck: Array<keyof InspectionRecord> = ['deviceType', 'photoUrl', 'anomalyType'];
  
  records.forEach(record => {
    fieldsToCheck.forEach(field => {
      const value = record[field];
      if (value === null || value === undefined || value === '') {
        results.push({ recordId: record.id, field });
      }
    });
  });
  
  return results;
}

export function detectDuplicateRecords(records: InspectionRecord[]): Array<{ recordIds: string[]; anomalyIds: string[]; similarity: number }> {
  const results: Array<{ recordIds: string[]; anomalyIds: string[]; similarity: number }> = [];
  const processed = new Set<string>();
  
  for (let i = 0; i < records.length; i++) {
    for (let j = i + 1; j < records.length; j++) {
      if (processed.has(records[i].id) || processed.has(records[j].id)) continue;
      
      const sim1 = stringSimilarity(records[i].description, records[j].description);
      const sim2 = stringSimilarity(records[i].deviceName, records[j].deviceName);
      const posDist = calculateDistance(
        { x: records[i].x, y: records[i].y, z: records[i].z },
        { x: records[j].x, y: records[j].y, z: records[j].z }
      );
      
      const overallSim = (sim1 + sim2) / 2;
      
      if (overallSim > 0.9 && posDist < 0.5) {
        const recordIds = [records[i].id, records[j].id];
        const anomalyIds = recordIds.map(() => generateId());
        results.push({ recordIds, anomalyIds, similarity: overallSim });
        processed.add(records[i].id);
        processed.add(records[j].id);
      }
    }
  }
  
  return results;
}

export function detectBoundaryRecords(records: InspectionRecord[]): Anomaly[] {
  const boundaries = [
    { x: 20, y: 15, z: 0, tolerance: 0.5 },
  ];
  
  return records
    .filter(record => {
      return boundaries.some(b => 
        Math.abs(record.x - b.x) < b.tolerance &&
        Math.abs(record.y - b.y) < b.tolerance &&
        Math.abs(record.z - b.z) < b.tolerance
      );
    })
    .map(record => ({
      id: generateId(),
      recordId: record.id,
      type: 'boundary_record' as const,
      severity: 'info' as const,
      status: 'pending' as const,
      reportedPosition: { x: record.x, y: record.y, z: record.z },
      isCrossFloor: false,
      relatedAnomalyIds: [],
      notes: [],
    }));
}

export function createAnomaliesFromRecords(records: InspectionRecord[]): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const offsetResults = detectCoordinateOffset(records);
  const duplicateNames = detectDuplicateNames(records);
  const missingPhotos = detectMissingPhotos(records);
  const crossFloor = detectCrossFloor(records);
  const nullValues = detectNullValues(records);
  const duplicates = detectDuplicateRecords(records);
  const boundaryRecords = detectBoundaryRecords(records);
  
  offsetResults.forEach(r => anomalies.push(r.anomaly));
  missingPhotos.forEach(a => anomalies.push(a));
  crossFloor.forEach(a => anomalies.push(a));
  boundaryRecords.forEach(a => anomalies.push(a));
  
  duplicateNames.forEach(d => {
    d.anomalyIds.forEach((id, index) => {
      const recordId = d.recordIds[index];
      const record = records.find(r => r.id === recordId);
      if (record) {
        anomalies.push({
          id,
          recordId: record.id,
          type: 'duplicate_name',
          severity: 'warning',
          status: 'pending',
          reportedPosition: { x: record.x, y: record.y, z: record.z },
          isCrossFloor: false,
          relatedAnomalyIds: d.anomalyIds.filter(aid => aid !== id),
          duplicateNames: d.names,
          notes: [],
        });
      }
    });
  });
  
  nullValues.forEach(nv => {
    const existing = anomalies.find(a => a.recordId === nv.recordId);
    if (existing) {
      existing.nullField = nv.field;
    } else {
      const record = records.find(r => r.id === nv.recordId);
      if (record) {
        anomalies.push({
          id: generateId(),
          recordId: record.id,
          type: 'null_value',
          severity: 'warning',
          status: 'pending',
          reportedPosition: { x: record.x, y: record.y, z: record.z },
          isCrossFloor: false,
          relatedAnomalyIds: [],
          notes: [],
          nullField: nv.field,
        });
      }
    }
  });
  
  duplicates.forEach(d => {
    d.anomalyIds.forEach((id, index) => {
      const recordId = d.recordIds[index];
      const record = records.find(r => r.id === recordId);
      if (record) {
        anomalies.push({
          id,
          recordId: record.id,
          type: 'duplicate_record',
          severity: 'warning',
          status: 'pending',
          reportedPosition: { x: record.x, y: record.y, z: record.z },
          isCrossFloor: false,
          relatedAnomalyIds: d.anomalyIds.filter(aid => aid !== id),
          isDuplicate: true,
          duplicateOf: d.anomalyIds[0],
          notes: [],
        });
      }
    });
  });
  
  const normalRecords = records.filter(r => 
    r.anomalyType === '正常' && !anomalies.some(a => a.recordId === r.id)
  );
  
  normalRecords.forEach(record => {
    anomalies.push({
      id: generateId(),
      recordId: record.id,
      type: 'normal',
      severity: 'info',
      status: 'completed',
      reportedPosition: { x: record.x, y: record.y, z: record.z },
      isCrossFloor: false,
      relatedAnomalyIds: [],
      notes: [],
    });
  });
  
  const otherRecords = records.filter(r => 
    !anomalies.some(a => a.recordId === r.id)
  );
  
  otherRecords.forEach(record => {
    anomalies.push({
      id: generateId(),
      recordId: record.id,
      type: 'normal',
      severity: 'warning',
      status: 'pending',
      reportedPosition: { x: record.x, y: record.y, z: record.z },
      isCrossFloor: false,
      relatedAnomalyIds: [],
      notes: [],
    });
  });
  
  return anomalies;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function runFullDataCheck(records: InspectionRecord[], _anomalies: Anomaly[]): DataCheckResult {
  return {
    coordinateOffsets: detectCoordinateOffset(records),
    duplicateNames: detectDuplicateNames(records),
    missingPhotos: detectMissingPhotos(records),
    crossFloor: detectCrossFloor(records),
    nullValues: detectNullValues(records),
    duplicates: detectDuplicateRecords(records),
    boundaryRecords: detectBoundaryRecords(records),
  };
}
