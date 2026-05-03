import type { ShootingSchedule, TimePoint, Camera, Battery, Charger, Scene, SceneCameraAssignment, TimeRange } from '../types';
import { parseTime } from './time';

export interface ParsingError {
  field: string;
  message: string;
  value?: unknown;
}

export interface ParseResult<T> {
  success: boolean;
  data?: T;
  errors: ParsingError[];
}

function isValidTimePoint(obj: unknown): obj is TimePoint {
  if (typeof obj !== 'object' || obj === null) return false;
  const t = obj as Record<string, unknown>;
  return (
    typeof t.hour === 'number' &&
    typeof t.minute === 'number' &&
    t.hour >= 0 &&
    t.hour < 24 &&
    t.minute >= 0 &&
    t.minute < 60
  );
}

function isValidTimeRange(obj: unknown): obj is TimeRange {
  if (typeof obj !== 'object' || obj === null) return false;
  const r = obj as Record<string, unknown>;
  return isValidTimePoint(r.start) && isValidTimePoint(r.end);
}

function parseTimePoint(value: unknown, fieldPath: string, errors: ParsingError[]): TimePoint | undefined {
  if (typeof value === 'string') {
    try {
      return parseTime(value);
    } catch {
      errors.push({ field: fieldPath, message: `Invalid time format: ${value}. Expected HH:MM`, value });
      return undefined;
    }
  }
  if (isValidTimePoint(value)) {
    return value as TimePoint;
  }
  errors.push({ field: fieldPath, message: 'Invalid time point', value });
  return undefined;
}

function parseTimeRange(value: unknown, fieldPath: string, errors: ParsingError[]): TimeRange | undefined {
  if (typeof value !== 'object' || value === null) {
    errors.push({ field: fieldPath, message: 'Expected object for time range', value });
    return undefined;
  }

  const r = value as Record<string, unknown>;
  const start = parseTimePoint(r.start, `${fieldPath}.start`, errors);
  const end = parseTimePoint(r.end, `${fieldPath}.end`, errors);

  if (!start || !end) return undefined;
  return { start, end };
}

function parseCamera(obj: unknown, index: number, errors: ParsingError[]): Camera | undefined {
  if (typeof obj !== 'object' || obj === null) {
    errors.push({ field: `cameras[${index}]`, message: 'Expected object for camera' });
    return undefined;
  }

  const c = obj as Record<string, unknown>;
  const resultErrors: ParsingError[] = [];

  const id = typeof c.id === 'string' ? c.id : `cam-${index + 1}`;
  const name = typeof c.name === 'string' ? c.name : `Camera ${index + 1}`;

  if (typeof c.powerConsumption !== 'number' || c.powerConsumption <= 0) {
    resultErrors.push({ field: `cameras[${index}].powerConsumption`, message: 'Must be a positive number' });
  }

  if (!Array.isArray(c.compatibleBatteryTypes) || c.compatibleBatteryTypes.length === 0) {
    resultErrors.push({ field: `cameras[${index}].compatibleBatteryTypes`, message: 'Must be a non-empty array of strings' });
  }

  errors.push(...resultErrors);
  if (resultErrors.length > 0) return undefined;

  return {
    id,
    name,
    powerConsumption: c.powerConsumption as number,
    compatibleBatteryTypes: c.compatibleBatteryTypes as string[],
  };
}

function parseBattery(obj: unknown, index: number, errors: ParsingError[]): Battery | undefined {
  if (typeof obj !== 'object' || obj === null) {
    errors.push({ field: `batteries[${index}]`, message: 'Expected object for battery' });
    return undefined;
  }

  const b = obj as Record<string, unknown>;
  const resultErrors: ParsingError[] = [];

  const id = typeof b.id === 'string' ? b.id : `bat-${index + 1}`;
  const name = typeof b.name === 'string' ? b.name : `Battery ${index + 1}`;

  if (typeof b.type !== 'string' || b.type.trim() === '') {
    resultErrors.push({ field: `batteries[${index}].type`, message: 'Battery type is required' });
  }

  if (typeof b.capacity !== 'number' || b.capacity <= 0) {
    resultErrors.push({ field: `batteries[${index}].capacity`, message: 'Must be a positive number' });
  }

  const initialCharge = typeof b.initialCharge === 'number' ? b.initialCharge : b.capacity ?? 100;
  if (initialCharge < 0 || initialCharge > (b.capacity ?? 100)) {
    resultErrors.push({ field: `batteries[${index}].initialCharge`, message: 'Must be between 0 and capacity' });
  }

  if (typeof b.status === 'string' && !['idle', 'in_use', 'charging', 'low', 'critical'].includes(b.status)) {
    resultErrors.push({ field: `batteries[${index}].status`, message: 'Invalid status value' });
  }

  errors.push(...resultErrors);
  if (resultErrors.length > 0) return undefined;

  return {
    id,
    name,
    type: b.type as string,
    capacity: b.capacity as number,
    initialCharge,
    currentCharge: initialCharge,
    status: (b.status as 'idle' | 'in_use' | 'charging' | 'low' | 'critical') || 'idle',
    assignedTo: typeof b.assignedTo === 'string' ? b.assignedTo : undefined,
    chargingPort: typeof b.chargingPort === 'string' ? b.chargingPort : undefined,
  };
}

function parseSceneCameraAssignment(
  obj: unknown,
  sceneIndex: number,
  camIndex: number,
  errors: ParsingError[]
): SceneCameraAssignment | undefined {
  if (typeof obj !== 'object' || obj === null) {
    errors.push({ field: `scenes[${sceneIndex}].cameras[${camIndex}]`, message: 'Expected object for camera assignment' });
    return undefined;
  }

  const a = obj as Record<string, unknown>;

  if (typeof a.cameraId !== 'string') {
    errors.push({ field: `scenes[${sceneIndex}].cameras[${camIndex}].cameraId`, message: 'Camera ID is required' });
    return undefined;
  }

  return {
    cameraId: a.cameraId,
    batteryId: typeof a.batteryId === 'string' ? a.batteryId : undefined,
  };
}

function parseScene(obj: unknown, index: number, errors: ParsingError[]): Scene | undefined {
  if (typeof obj !== 'object' || obj === null) {
    errors.push({ field: `scenes[${index}]`, message: 'Expected object for scene' });
    return undefined;
  }

  const s = obj as Record<string, unknown>;
  const resultErrors: ParsingError[] = [];

  const id = typeof s.id === 'string' ? s.id : `scene-${index + 1}`;
  const name = typeof s.name === 'string' ? s.name : `Scene ${index + 1}`;

  const timeRange = parseTimeRange(s.timeRange, `scenes[${index}].timeRange`, resultErrors);

  if (!Array.isArray(s.cameras)) {
    resultErrors.push({ field: `scenes[${index}].cameras`, message: 'Must be an array' });
  }

  const cameraAssignments: SceneCameraAssignment[] = [];
  if (Array.isArray(s.cameras)) {
    for (let i = 0; i < s.cameras.length; i++) {
      const assignment = parseSceneCameraAssignment(s.cameras[i], index, i, resultErrors);
      if (assignment) cameraAssignments.push(assignment);
    }
  }

  errors.push(...resultErrors);
  if (resultErrors.length > 0) return undefined;

  return {
    id,
    name,
    timeRange: timeRange!,
    cameras: cameraAssignments,
    notes: typeof s.notes === 'string' ? s.notes : undefined,
  };
}

function parseCharger(obj: unknown, index: number, errors: ParsingError[]): Charger | undefined {
  if (typeof obj !== 'object' || obj === null) {
    errors.push({ field: `chargers[${index}]`, message: 'Expected object for charger' });
    return undefined;
  }

  const c = obj as Record<string, unknown>;
  const resultErrors: ParsingError[] = [];

  const id = typeof c.id === 'string' ? c.id : `charger-${index + 1}`;
  const name = typeof c.name === 'string' ? c.name : `Charger ${index + 1}`;

  if (!Array.isArray(c.ports) || c.ports.length === 0) {
    resultErrors.push({ field: `chargers[${index}].ports`, message: 'Must be a non-empty array' });
  }

  const ports = (c.ports as unknown[]).map((p, pi) => {
    if (typeof p !== 'object' || p === null) {
      resultErrors.push({ field: `chargers[${index}].ports[${pi}]`, message: 'Invalid port object' });
      return null;
    }
    const port = p as Record<string, unknown>;
    return {
      id: typeof port.id === 'string' ? port.id : `${id}-port-${pi + 1}`,
      chargerId: id,
      name: typeof port.name === 'string' ? port.name : `Port ${pi + 1}`,
      compatibleBatteryTypes: Array.isArray(port.compatibleBatteryTypes) ? port.compatibleBatteryTypes : [],
      chargingSpeed: typeof port.chargingSpeed === 'number' ? port.chargingSpeed : 15,
      occupiedBy: typeof port.occupiedBy === 'string' ? port.occupiedBy : undefined,
    };
  }).filter(Boolean) as typeof c.ports;

  errors.push(...resultErrors);
  if (resultErrors.length > 0) return undefined;

  return { id, name, ports };
}

export function parseSchedule(jsonStr: string): ParseResult<ShootingSchedule> {
  const errors: ParsingError[] = [];
  let obj: unknown;

  try {
    obj = JSON.parse(jsonStr);
  } catch (e) {
    return {
      success: false,
      errors: [{ field: 'root', message: `Invalid JSON: ${(e as Error).message}` }],
    };
  }

  if (typeof obj !== 'object' || obj === null) {
    return { success: false, errors: [{ field: 'root', message: 'Expected an object' }] };
  }

  const s = obj as Record<string, unknown>;

  const id = typeof s.id === 'string' ? s.id : 'schedule-' + Date.now();
  const name = typeof s.name === 'string' ? s.name : 'Unnamed Schedule';
  const date = typeof s.date === 'string' ? s.date : new Date().toISOString().split('T')[0];

  if (!Array.isArray(s.cameras)) {
    errors.push({ field: 'cameras', message: 'Must be an array' });
  }
  if (!Array.isArray(s.batteries)) {
    errors.push({ field: 'batteries', message: 'Must be an array' });
  }
  if (!Array.isArray(s.scenes)) {
    errors.push({ field: 'scenes', message: 'Must be an array' });
  }
  if (s.chargers !== undefined && !Array.isArray(s.chargers)) {
    errors.push({ field: 'chargers', message: 'Must be an array if provided' });
  }

  const cameras: Camera[] = [];
  if (Array.isArray(s.cameras)) {
    for (let i = 0; i < s.cameras.length; i++) {
      const cam = parseCamera(s.cameras[i], i, errors);
      if (cam) cameras.push(cam);
    }
  }

  const batteries: Battery[] = [];
  if (Array.isArray(s.batteries)) {
    for (let i = 0; i < s.batteries.length; i++) {
      const bat = parseBattery(s.batteries[i], i, errors);
      if (bat) batteries.push(bat);
    }
  }

  const chargers: Charger[] = [];
  if (Array.isArray(s.chargers)) {
    for (let i = 0; i < s.chargers.length; i++) {
      const chg = parseCharger(s.chargers[i], i, errors);
      if (chg) chargers.push(chg);
    }
  }

  const scenes: Scene[] = [];
  if (Array.isArray(s.scenes)) {
    for (let i = 0; i < s.scenes.length; i++) {
      const scene = parseScene(s.scenes[i], i, errors);
      if (scene) scenes.push(scene);
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: { id, name, date, cameras, batteries, chargers, scenes },
    errors: [],
  };
}
