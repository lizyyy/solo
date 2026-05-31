import { db } from '@/db';
import { generateId } from '@/db/seed';
import { MaterialBatch, DeviceRemark, CADPoint, SightRecord } from '@/types';

export async function calculateChecksum(
  deviceRemarks: DeviceRemark[],
  cadPoints: CADPoint[]
): Promise<string> {
  const data = {
    deviceRemarks: deviceRemarks
      .sort((a, b) => a.deviceCode.localeCompare(b.deviceCode))
      .map((r) => ({
        deviceCode: r.deviceCode,
        content: r.content,
        coordinate: r.coordinate,
        area: r.area,
      })),
    cadPoints: cadPoints
      .sort((a, b) => a.pointCode.localeCompare(b.pointCode))
      .map((p) => ({
        pointCode: p.pointCode,
        x: p.x,
        y: p.y,
        z: p.z,
      })),
  };

  const jsonString = JSON.stringify(data);
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(jsonString);

  if (crypto.subtle && crypto.subtle.digest) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    return `sha256:${hashHex}`;
  }

  let hash = 0;
  for (let i = 0; i < jsonString.length; i++) {
    const char = jsonString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `simple:${Math.abs(hash).toString(16).padStart(16, '0')}`;
}

export async function findExistingBatch(
  projectId: string,
  checksum: string
): Promise<MaterialBatch | null> {
  const existing = await db.materialBatches
    .where('[projectId+checksum]')
    .equals([projectId, checksum])
    .first();

  return existing || null;
}

export async function createBatch(
  projectId: string,
  deviceRemarks: DeviceRemark[],
  cadPoints: CADPoint[],
  importer: string
): Promise<MaterialBatch> {
  const checksum = await calculateChecksum(deviceRemarks, cadPoints);
  const existingBatch = await findExistingBatch(projectId, checksum);

  if (existingBatch) {
    return existingBatch;
  }

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const count = await db.materialBatches.where('projectId').equals(projectId).count() + 1;

  const batch: MaterialBatch = {
    id: `batch-${generateId()}`,
    projectId,
    batchNo: `BATCH-${dateStr}-${count.toString().padStart(3, '0')}`,
    checksum,
    importedAt: now,
    importer,
    recordCount: deviceRemarks.length + cadPoints.length,
  };

  await db.materialBatches.add(batch);
  return batch;
}

export async function getOrCreateSightRecords(
  projectId: string,
  batch: MaterialBatch,
  calculateSight: (device: DeviceRemark, point: CADPoint) => Partial<SightRecord>
): Promise<{ records: SightRecord[]; isReused: boolean }> {
  const existingRecords = await db.sightRecords
    .where('[projectId+batchId]')
    .equals([projectId, batch.id])
    .toArray();

  if (existingRecords.length > 0) {
    return { records: existingRecords, isReused: true };
  }

  const devices = await db.deviceRemarks
    .where('[projectId+batchId]')
    .equals([projectId, batch.id])
    .toArray();

  const points = await db.cadPoints
    .where('[projectId+batchId]')
    .equals([projectId, batch.id])
    .toArray();

  const now = new Date();
  const records: SightRecord[] = [];

  for (const device of devices) {
    const matchingPoint = points.find((p) => {
      const deviceArea = device.area.replace(/[^A-Z]/g, '');
      const pointArea = p.pointCode.replace(/[^A-Z]/g, '');
      return deviceArea === pointArea;
    });

    if (matchingPoint) {
      const calculated = calculateSight(device, matchingPoint);
      records.push({
        id: `sight-${generateId()}`,
        projectId,
        batchId: batch.id,
        deviceCode: device.deviceCode,
        pointCode: matchingPoint.pointCode,
        deviceName: device.deviceName,
        pointName: matchingPoint.pointName,
        conclusion: calculated.conclusion || '',
        sightValue: calculated.sightValue || 0,
        status: calculated.status || 'pending',
        isManualModified: calculated.isManualModified || false,
        traceSource: calculated.traceSource || 'device-remark',
        createdAt: now,
        updatedAt: now,
        ...(calculated.manualModifier && { manualModifier: calculated.manualModifier }),
        ...(calculated.manualModifiedAt && { manualModifiedAt: calculated.manualModifiedAt }),
        ...(calculated.manualReason && { manualReason: calculated.manualReason }),
      });
    }
  }

  if (records.length > 0) {
    await db.sightRecords.bulkAdd(records);
  }

  return { records, isReused: false };
}

export async function getBatchReuseInfo(batchId: string): Promise<{
  isReused: boolean;
  originalCreatedAt?: Date;
  reuseCount: number;
}> {
  const records = await db.sightRecords.where('batchId').equals(batchId).toArray();

  if (records.length === 0) {
    return { isReused: false, reuseCount: 0 };
  }

  const createdAt = records[0].createdAt;
  const updatedAt = records[0].updatedAt;
  const isReused = createdAt.getTime() !== updatedAt.getTime();

  const batch = await db.materialBatches.get(batchId);
  const reuseCount = batch ? Math.floor((updatedAt.getTime() - createdAt.getTime()) / (24 * 60 * 60 * 1000)) : 0;

  return {
    isReused,
    originalCreatedAt: createdAt,
    reuseCount: isReused ? Math.max(1, reuseCount) : 0,
  };
}
