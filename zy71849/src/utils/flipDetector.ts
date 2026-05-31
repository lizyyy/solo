import { db } from '@/db';
import { generateId } from '@/db/seed';
import { CADPoint, DeviceRemark, FlipType, FlipSource, FlipRecord, CONTACT_ROLES } from '@/types';

interface AxisStats {
  deviceValues: number[];
  cadValues: number[];
  deviceSign: number;
  cadSign: number;
  isFlipped: boolean;
}

function getAxisStats(devices: DeviceRemark[], points: CADPoint[], axis: 'x' | 'y' | 'z'): AxisStats {
  const deviceValues = devices.map((d) => d.coordinate[axis]).filter((v) => v !== 0);
  const cadValues = points.map((p) => p[axis]).filter((v) => v !== 0);

  const deviceSign = deviceValues.length > 0 ? Math.sign(deviceValues.reduce((a, b) => a + b, 0)) : 1;
  const cadSign = cadValues.length > 0 ? Math.sign(cadValues.reduce((a, b) => a + b, 0)) : 1;

  const deviceAbsSum = deviceValues.reduce((a, b) => a + Math.abs(b), 0);
  const cadAbsSum = cadValues.reduce((a, b) => a + Math.abs(b), 0);

  const deviceNormalized = deviceAbsSum > 0 ? deviceSign * deviceAbsSum / deviceValues.length : 0;
  const cadNormalized = cadAbsSum > 0 ? cadSign * cadAbsSum / cadValues.length : 0;

  const isFlipped = deviceNormalized * cadNormalized < 0;

  return {
    deviceValues,
    cadValues,
    deviceSign,
    cadSign,
    isFlipped,
  };
}

export function detectFlipType(
  devices: DeviceRemark[],
  points: CADPoint[]
): { flipType: FlipType; flipSource: FlipSource } {
  const xStats = getAxisStats(devices, points, 'x');
  const yStats = getAxisStats(devices, points, 'y');
  const zStats = getAxisStats(devices, points, 'z');

  const flippedAxes: string[] = [];
  if (xStats.isFlipped) flippedAxes.push('x');
  if (yStats.isFlipped) flippedAxes.push('y');
  if (zStats.isFlipped) flippedAxes.push('z');

  if (flippedAxes.length === 0) {
    return { flipType: 'none', flipSource: 'device-remark' };
  }

  const flipType = `${flippedAxes.join('-')}-flip` as FlipType;

  const deviceFlippedCount = [xStats, yStats, zStats].filter(
    (s, i) => ['x', 'y', 'z'][i] && s.isFlipped && s.deviceSign !== 1
  ).length;

  const cadFlippedCount = [xStats, yStats, zStats].filter(
    (s, i) => ['x', 'y', 'z'][i] && s.isFlipped && s.cadSign !== 1
  ).length;

  let flipSource: FlipSource;
  if (deviceFlippedCount > cadFlippedCount) {
    flipSource = 'device-remark';
  } else if (cadFlippedCount > deviceFlippedCount) {
    flipSource = 'cad-point';
  } else {
    flipSource = 'both';
  }

  return { flipType, flipSource };
}

export function detectPointFlip(
  device: DeviceRemark,
  point: CADPoint
): { hasFlip: boolean; flipType: FlipType; flipSource: FlipSource } {
  const xFlipped = device.coordinate.x * point.x < 0;
  const yFlipped = device.coordinate.y * point.y < 0;
  const zFlipped = device.coordinate.z * point.z < 0;

  const flippedAxes: string[] = [];
  if (xFlipped) flippedAxes.push('x');
  if (yFlipped) flippedAxes.push('y');
  if (zFlipped) flippedAxes.push('z');

  if (flippedAxes.length === 0) {
    return { hasFlip: false, flipType: 'none', flipSource: 'device-remark' };
  }

  const flipType = `${flippedAxes.join('-')}-flip` as FlipType;

  const deviceNegCount = [
    device.coordinate.x < 0,
    device.coordinate.y < 0,
    device.coordinate.z < 0,
  ].filter(Boolean).length;

  const cadNegCount = [point.x < 0, point.y < 0, point.z < 0].filter(Boolean).length;

  let flipSource: FlipSource;
  if (deviceNegCount > cadNegCount) {
    flipSource = 'device-remark';
  } else if (cadNegCount > deviceNegCount) {
    flipSource = 'cad-point';
  } else {
    flipSource = 'both';
  }

  return { hasFlip: true, flipType, flipSource };
}

export async function createFlipRecord(
  cadPointId: string,
  projectId: string,
  flipType: FlipType,
  flipSource: FlipSource,
  remark: string
): Promise<FlipRecord> {
  const contactInfo = CONTACT_ROLES[flipSource];

  const flipRecord: FlipRecord = {
    id: `flip-${generateId()}`,
    cadPointId,
    projectId,
    flipType,
    source: flipSource,
    assignee: contactInfo.contact,
    assigneeRole: contactInfo.role,
    status: 'pending',
    remark,
    createdAt: new Date(),
  };

  await db.flipRecords.add(flipRecord);

  await db.cadPoints.update(cadPointId, {
    hasFlip: true,
    flipType,
    flipSource,
  });

  return flipRecord;
}

export async function resolveFlipRecord(
  flipId: string,
  resolver: string,
  resolutionNote: string
): Promise<void> {
  const flipRecord = await db.flipRecords.get(flipId);
  if (!flipRecord) return;

  await db.flipRecords.update(flipId, {
    status: 'resolved',
    resolvedAt: new Date(),
    resolver,
    remark: `${flipRecord.remark}\n\n处理备注：${resolutionNote}`,
  });

  await db.cadPoints.update(flipRecord.cadPointId, {
    hasFlip: false,
    flipType: 'none',
    flipSource: undefined,
  });
}

export async function getFlipRecordsForProject(projectId: string): Promise<FlipRecord[]> {
  return db.flipRecords.where('projectId').equals(projectId).reverse().sortBy('createdAt');
}

export async function getPendingFlipCount(projectId: string): Promise<number> {
  return db.flipRecords
    .where('[projectId+status]')
    .equals([projectId, 'pending'])
    .count();
}

export function getNextStepForFlip(flipSource: FlipSource): { step: string; contact: string; role: string } {
  const contactInfo = CONTACT_ROLES[flipSource];

  const nextSteps: Record<FlipSource, string> = {
    'device-remark': '请设备工程师核对设备备注中的坐标数据，确认坐标系方向是否正确',
    'cad-point': '请CAD设计师核对CAD导出的点位坐标，检查导出时是否进行了坐标变换',
    'both': '请项目经理协调设备工程师和CAD设计师共同核对坐标系统一性',
  };

  return {
    step: nextSteps[flipSource],
    contact: contactInfo.contact,
    role: contactInfo.role,
  };
}
