import type { FieldNote, SensorRecord, DeviceParam, DataConflict } from '../types';

const CONFLICT_THRESHOLD = 0.1;

function generateId(): string {
  return `conflict_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export interface ExtractedValue {
  value: number;
  context: string;
  unit?: string;
}

export function extractNumericValues(text: string): ExtractedValue[] {
  const results: ExtractedValue[] = [];

  const patterns = [
    /([\u4e00-\u9fa5a-zA-Z]+)\s*(约|大概|左右|接近|≈|~)?\s*(\d+\.?\d*)\s*(米|m|厘米|cm|英尺|ft|千克|kg|克|g|度|°|秒|s|毫秒|ms|公里\/小时|km\/h|米\/秒|m\/s)?/g,
    /(\d+\.?\d*)\s*(米|m|厘米|cm|英尺|ft|千克|kg|克|g|度|°|秒|s|毫秒|ms|公里\/小时|km\/h|米\/秒|m\/s)\s*([\u4e00-\u9fa5a-zA-Z]+)?/g,
  ];

  patterns.forEach((pattern) => {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const numMatch = match[0].match(/\d+\.?\d*/);
      if (numMatch) {
        const value = parseFloat(numMatch[0]);
        results.push({
          value,
          context: match[0],
          unit: match[2] || match[3] || undefined,
        });
      }
    }
  });

  return results.filter((v, i, arr) => arr.findIndex((x) => x.context === v.context) === i);
}

export function extractUnitMentions(text: string): string[] {
  const units: string[] = [];
  const unitMap: Record<string, string> = {
    米: 'm',
    公尺: 'm',
    厘米: 'cm',
    公分: 'cm',
    毫米: 'mm',
    英尺: 'ft',
    英寸: 'in',
    千克: 'kg',
    公斤: 'kg',
    克: 'g',
    磅: 'lb',
    度: 'deg',
    秒: 's',
    毫秒: 'ms',
    m: 'm',
    cm: 'cm',
    mm: 'mm',
    ft: 'ft',
    in: 'in',
    kg: 'kg',
    g: 'g',
    lb: 'lb',
    s: 's',
    ms: 'ms',
    deg: 'deg',
    '°': 'deg',
  };

  Object.keys(unitMap).forEach((key) => {
    if (text.includes(key) && !units.includes(unitMap[key])) {
      units.push(unitMap[key]);
    }
  });

  return units;
}

export function extractDirectionMentions(text: string): string[] {
  const directions: string[] = [];
  const dirMap: Record<string, string> = {
    北: 'N',
    南: 'S',
    东: 'E',
    西: 'W',
    东北: 'NE',
    西北: 'NW',
    东南: 'SE',
    西南: 'SW',
    向北: 'N',
    朝南: 'S',
    向东: 'E',
    往西: 'W',
    N: 'N',
    S: 'S',
    E: 'E',
    W: 'W',
    NE: 'NE',
    NW: 'NW',
    SE: 'SE',
    SW: 'SW',
  };

  Object.keys(dirMap).forEach((key) => {
    if (text.includes(key) && !directions.includes(dirMap[key])) {
      directions.push(dirMap[key]);
    }
  });

  return directions;
}

function normalizeUnit(unit: string): string {
  const map: Record<string, string> = {
    米: 'm',
    公尺: 'm',
    厘米: 'cm',
    公分: 'cm',
    毫米: 'mm',
    英尺: 'ft',
    英寸: 'in',
    千克: 'kg',
    公斤: 'kg',
    克: 'g',
    磅: 'lb',
    度: 'deg',
    秒: 's',
    毫秒: 'ms',
    '°': 'deg',
  };
  return map[unit] || unit;
}

export function detectValueConflicts(
  notes: FieldNote[],
  records: SensorRecord[],
  params: DeviceParam[]
): DataConflict[] {
  const conflicts: DataConflict[] = [];

  notes.forEach((note) => {
    const extracted = extractNumericValues(note.content);

    extracted.forEach((extractedVal) => {
      records.forEach((record) => {
        const fieldsToCheck = [
          { name: '发射角度', value: record.angle, unit: record.angleUnit },
          { name: '发射速度', value: record.velocity, unit: record.velocityUnit },
          { name: '采样间隔', value: record.timeInterval, unit: record.timeIntervalUnit },
        ];

        fieldsToCheck.forEach((field) => {
          if (field.value !== null) {
            const diff = Math.abs(extractedVal.value - field.value) / Math.max(Math.abs(field.value), 1);
            if (diff > CONFLICT_THRESHOLD) {
              conflicts.push({
                id: generateId(),
                projectId: note.projectId,
                field: field.name,
                recordId: record.id,
                photoEvidence: note.content,
                photoValue: extractedVal.value,
                photoUnit: extractedVal.unit,
                importedValue: `${field.value} ${field.unit}`,
                importedSource: `传感器记录 ${record.timestamp}`,
                suggestedActions: [
                  '以现场照片为准修正',
                  '以导入数据为准',
                  '重新测量确认',
                  '保留原值并标记待核实',
                ],
              });
            }
          }
        });
      });

      params.forEach((param) => {
        if (param.value !== null) {
          const diff = Math.abs(extractedVal.value - param.value) / Math.max(Math.abs(param.value), 1);
          if (diff > CONFLICT_THRESHOLD) {
            conflicts.push({
              id: generateId(),
              projectId: note.projectId,
              field: param.paramName,
              photoEvidence: note.content,
              photoValue: extractedVal.value,
              photoUnit: extractedVal.unit,
              importedValue: `${param.value} ${param.unit}`,
              importedSource: `设备参数: ${param.paramName}`,
              suggestedActions: [
                '以现场照片为准修正',
                '以导入数据为准',
                '重新测量确认',
                '保留原值并标记待核实',
              ],
            });
          }
        }
      });
    });
  });

  return conflicts.filter(
    (c, i, arr) => arr.findIndex((x) => x.field === c.field && x.photoEvidence === c.photoEvidence) === i
  );
}

export function detectUnitConflicts(
  notes: FieldNote[],
  records: SensorRecord[],
  _params: DeviceParam[]
): DataConflict[] {
  const conflicts: DataConflict[] = [];

  notes.forEach((note) => {
    const mentionedUnits = extractUnitMentions(note.content);
    if (mentionedUnits.length === 0) return;

    records.forEach((record) => {
      const recordUnits = [
        normalizeUnit(record.angleUnit),
        normalizeUnit(record.velocityUnit),
        normalizeUnit(record.timeIntervalUnit),
      ];

      mentionedUnits.forEach((mentionedUnit) => {
        if (!recordUnits.includes(mentionedUnit) && mentionedUnit !== 'deg') {
          const isRelevant = note.content.includes('角度') || note.content.includes('速度') || note.content.includes('时间');
          if (isRelevant) {
            conflicts.push({
              id: generateId(),
              projectId: note.projectId,
              field: '单位',
              recordId: record.id,
              photoEvidence: note.content,
              importedValue: recordUnits.filter(Boolean).join(', '),
              importedSource: `传感器记录单位`,
              suggestedActions: [
                `统一使用${mentionedUnit}`,
                `保持现有单位换算`,
                '现场确认实际单位',
              ],
            });
          }
        }
      });
    });
  });

  return conflicts.slice(0, 5);
}

export function detectDirectionConflicts(notes: FieldNote[], records: SensorRecord[]): DataConflict[] {
  const conflicts: DataConflict[] = [];

  notes.forEach((note) => {
    const mentionedDirs = extractDirectionMentions(note.content);
    if (mentionedDirs.length === 0) return;

    records.forEach((record) => {
      const recordDir = record.direction.trim().toUpperCase();
      const isMatch =
        mentionedDirs.includes(recordDir) ||
        mentionedDirs.some((d) => d.includes(recordDir)) ||
        !isNaN(parseFloat(recordDir));

      if (!isMatch) {
        conflicts.push({
          id: generateId(),
          projectId: note.projectId,
          field: '方向',
          recordId: record.id,
          photoEvidence: note.content,
          importedValue: record.direction,
          importedSource: '传感器方向',
          suggestedActions: ['以现场描述方向为准', '以传感器方向为准', '现场确认方向'],
        });
      }
    });
  });

  return conflicts.slice(0, 3);
}

export function detectAllConflicts(
  notes: FieldNote[],
  records: SensorRecord[],
  params: DeviceParam[]
): DataConflict[] {
  const valueConflicts = detectValueConflicts(notes, records, params);
  const unitConflicts = detectUnitConflicts(notes, records, params);
  const directionConflicts = detectDirectionConflicts(notes, records);

  return [...valueConflicts, ...unitConflicts, ...directionConflicts];
}
