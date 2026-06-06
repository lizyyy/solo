import type { WorkPhoto, InspectionNote, Conflict, TemperatureUnit, ConflictType } from '@/types';

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

export function downloadJSON(data: any, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
