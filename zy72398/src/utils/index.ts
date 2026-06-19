import type { WorkPhoto, InspectionNote, Conflict, TemperatureUnit, ConflictType, DiffusionCalcResult, RecalcDiff, ExportMismatch, VerifyExportTarget, ReportItem } from '@/types';

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export function celsiusToKelvin(celsius: number): number {
  return celsius + 273.15;
}

export function kelvinToCelsius(kelvin: number): number {
  return kelvin - 273.15;
}

export function convertTemperature(value: number, from: TemperatureUnit, to: TemperatureUnit): number {
  if (from === to) return value;
  if (from === 'C' && to === 'K') return celsiusToKelvin(value);
  return kelvinToCelsius(value);
}

export function formatTemperature(value: number, unit: TemperatureUnit): string {
  return `${value.toFixed(1)}°${unit === 'C' ? 'C' : 'K'}`;
}

export function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function getConflictTypeName(type: ConflictType): string {
  const names: Record<ConflictType, string> = {
    temperature: '温度差异',
    dissolved_oxygen: '溶氧值差异',
    time: '记录时间差异'
  };
  return names[type];
}

export function getBatchTypeName(type: string): string {
  const names: Record<string, string> = {
    normal: '正常材料',
    wrong_caliber: '错口径材料',
    supplementary: '补录材料'
  };
  return names[type] || type;
}

export function detectTemperatureMixing(photos: WorkPhoto[], notes: InspectionNote[]): { mixed: boolean; details: string[] } {
  const details: string[] = [];
  
  const photoUnits = new Map<string, TemperatureUnit[]>();
  photos.forEach(p => {
    const key = p.deviceNo;
    if (!photoUnits.has(key)) photoUnits.set(key, []);
    photoUnits.get(key)!.push(p.temperatureUnit);
  });
  
  photoUnits.forEach((units, deviceNo) => {
    const hasC = units.includes('C');
    const hasK = units.includes('K');
    if (hasC && hasK) {
      details.push(`设备 ${deviceNo} 的工况照片同时使用了摄氏度和开尔文`);
    }
  });
  
  const noteUnits = new Map<string, TemperatureUnit[]>();
  notes.forEach(n => {
    if (n.temperatureUnit) {
      const key = n.workPhotoId;
      if (!noteUnits.has(key)) noteUnits.set(key, []);
      noteUnits.get(key)!.push(n.temperatureUnit);
    }
  });
  
  photos.forEach(p => {
    const noteUnitList = noteUnits.get(p.id) || [];
    const allUnits = [p.temperatureUnit, ...noteUnitList];
    const hasC = allUnits.includes('C');
    const hasK = allUnits.includes('K');
    if (hasC && hasK) {
      details.push(`记录 ${p.deviceNo} (${p.recordTime}) 存在摄氏度/开尔文混用，待训练教练复核`);
    }
  });
  
  return { mixed: details.length > 0, details };
}

export function detectConflicts(photo: WorkPhoto, note: InspectionNote): Conflict[] {
  const conflicts: Conflict[] = [];
  
  if (note.temperature !== undefined && note.temperatureUnit) {
    const photoTempInC = convertTemperature(photo.temperature, photo.temperatureUnit, 'C');
    const noteTempInC = convertTemperature(note.temperature, note.temperatureUnit, 'C');
    if (Math.abs(photoTempInC - noteTempInC) > 2) {
      conflicts.push({
        id: generateId(),
        workPhotoId: photo.id,
        inspectionNoteId: note.id,
        conflictType: 'temperature',
        photoValue: formatTemperature(photo.temperature, photo.temperatureUnit),
        noteValue: formatTemperature(note.temperature, note.temperatureUnit),
        status: 'pending',
        createdAt: new Date().toISOString()
      });
    }
  }
  
  const photoTime = new Date(photo.recordTime).getTime();
  const noteTime = new Date(note.inspectionTime).getTime();
  if (Math.abs(photoTime - noteTime) > 30 * 60 * 1000) {
    conflicts.push({
      id: generateId(),
      workPhotoId: photo.id,
      inspectionNoteId: note.id,
      conflictType: 'time',
      photoValue: formatDateTime(photo.recordTime),
      noteValue: formatDateTime(note.inspectionTime),
      status: 'pending',
      createdAt: new Date().toISOString()
    });
  }
  
  return conflicts;
}

export function calculateDiffusionRate(doValue: number, tempC: number, timeHours: number): number {
  const baseRate = 0.05;
  const tempFactor = 1 + (tempC - 20) * 0.02;
  return doValue * baseRate * tempFactor * timeHours;
}

export function computeDiffusionForPhoto(photo: WorkPhoto, refTime?: string): DiffusionCalcResult {
  const tempC = convertTemperature(photo.temperature, photo.temperatureUnit, 'C');
  const refMs = refTime ? new Date(refTime).getTime() : Date.now();
  const recMs = new Date(photo.recordTime).getTime();
  const timeHours = Math.max(0.5, Math.abs(refMs - recMs) / 3600000);
  const diffusionRate = calculateDiffusionRate(photo.dissolvedOxygen, tempC, timeHours);
  return {
    workPhotoId: photo.id,
    deviceNo: photo.deviceNo,
    dissolvedOxygen: photo.dissolvedOxygen,
    temperatureC: tempC,
    timeHours,
    diffusionRate,
    batchType: photo.batchType,
    calculatedAt: new Date().toISOString()
  };
}

export function computeRecalcDiffs(
  normalPhotos: WorkPhoto[],
  supplementaryPhotos: WorkPhoto[],
  refTime?: string
): RecalcDiff[] {
  const diffs: RecalcDiff[] = [];
  const normalByDevice = new Map<string, WorkPhoto>();
  normalPhotos.forEach(p => normalByDevice.set(p.deviceNo, p));
  
  supplementaryPhotos.forEach(sup => {
    const normal = normalByDevice.get(sup.deviceNo);
    if (!normal) return;
    
    const normalCalc = computeDiffusionForPhoto(normal, refTime);
    const supCalc = computeDiffusionForPhoto(sup, refTime);
    
    const diffAbsolute = Math.abs(supCalc.diffusionRate - normalCalc.diffusionRate);
    const diffPercent = normalCalc.diffusionRate > 0
      ? (diffAbsolute / normalCalc.diffusionRate) * 100
      : 0;
    
    diffs.push({
      deviceNo: sup.deviceNo,
      normalDiffusionRate: normalCalc.diffusionRate,
      supplementaryDiffusionRate: supCalc.diffusionRate,
      diffAbsolute,
      diffPercent,
      recordTime: sup.recordTime
    });
  });
  
  return diffs;
}

export function verifyExportConsistency(
  photos: WorkPhoto[],
  notes: InspectionNote[],
  conflicts: Conflict[],
  report: VerifyExportTarget
): ExportMismatch[] {
  const mismatches: ExportMismatch[] = [];
  
  const targetReport = 'report' in report ? report.report : report;
  if (!targetReport || !targetReport.items) return mismatches;
  
  targetReport.items.forEach((item: ReportItem) => {
    const photo = photos.find(p => p.id === item.workPhotoId);
    if (!photo) {
      mismatches.push({
        category: '工况照片',
        field: '记录存在性',
        expectedValue: `应存在ID=${item.workPhotoId}`,
        actualValue: '未找到',
        recordId: item.workPhotoId
      });
      return;
    }
    
    if (photo.deviceNo !== item.deviceNo) {
      mismatches.push({
        category: '工况照片',
        field: '设备编号',
        expectedValue: photo.deviceNo,
        actualValue: item.deviceNo,
        recordId: item.workPhotoId
      });
    }
    if (Math.abs(photo.dissolvedOxygen - item.dissolvedOxygen) > 0.001) {
      mismatches.push({
        category: '工况照片',
        field: '溶氧值',
        expectedValue: String(photo.dissolvedOxygen),
        actualValue: String(item.dissolvedOxygen),
        recordId: item.workPhotoId
      });
    }
    const photoTempC = convertTemperature(photo.temperature, photo.temperatureUnit, 'C');
    const itemTempC = convertTemperature(item.temperature, item.temperatureUnit, 'C');
    if (Math.abs(photoTempC - itemTempC) > 0.01) {
      mismatches.push({
        category: '工况照片',
        field: '温度(转摄氏度后)',
        expectedValue: `${photoTempC.toFixed(2)}°C`,
        actualValue: `${itemTempC.toFixed(2)}°C`,
        recordId: item.workPhotoId
      });
    }
  });
  
  const exportedPhotoIds = new Set(targetReport.items?.map((i: ReportItem) => i.workPhotoId) || []);
  photos.forEach(p => {
    if (!exportedPhotoIds.has(p.id)) {
      mismatches.push({
        category: '工况照片',
        field: '导出完整性',
        expectedValue: `照片 ${p.deviceNo} 应在报告中`,
        actualValue: '报告中缺失',
        recordId: p.id
      });
    }
  });
  
  const reportNotes = targetReport.inspectionNotes || [];
  const exportedNoteIds = new Set(reportNotes.map((n: InspectionNote) => n.id));
  notes.forEach(n => {
    if (!exportedNoteIds.has(n.id)) {
      mismatches.push({
        category: '巡检备注',
        field: '导出完整性',
        expectedValue: `备注 ${n.inspectorName} 应在导出中`,
        actualValue: '导出中缺失',
        recordId: n.id
      });
    }
  });
  
  const reportConflicts = targetReport.conflicts || [];
  const exportedConflictIds = new Set(reportConflicts.map((c: Conflict) => c.id));
  conflicts.forEach(c => {
    if (!exportedConflictIds.has(c.id)) {
      mismatches.push({
        category: '冲突记录',
        field: '导出完整性',
        expectedValue: `冲突 ${c.id} 应在导出中`,
        actualValue: '导出中缺失',
        recordId: c.id
      });
    }
  });
  
  return mismatches;
}

export function deduplicatePhotosByDeviceTime(photos: WorkPhoto[]): WorkPhoto[] {
  const seen = new Map<string, WorkPhoto>();
  photos.forEach(p => {
    const key = `${p.deviceNo}_${new Date(p.recordTime).getTime()}`;
    if (!seen.has(key)) {
      seen.set(key, p);
    } else {
      const existing = seen.get(key)!;
      if (p.batchType === 'supplementary' && existing.batchType !== 'supplementary') {
        seen.set(key, p);
      }
    }
  });
  return Array.from(seen.values());
}

export function downloadJSON(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
