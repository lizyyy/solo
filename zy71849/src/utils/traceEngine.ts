import { db } from '@/db';
import { generateId } from '@/db/seed';
import {
  SightRecord,
  TraceLink,
  TraceSourceType,
  DeviceRemark,
  CADPoint,
  TraceChain,
  RemarkHistory,
} from '@/types';

export async function createTraceLink(
  recordId: string,
  sourceType: TraceSourceType,
  sourceId: string,
  sourceSnapshot: Record<string, unknown>,
  linkType: 'primary' | 'secondary' | 'manual' = 'primary'
): Promise<TraceLink> {
  const link: TraceLink = {
    id: `trace-${generateId()}`,
    recordId,
    sourceType,
    sourceId,
    sourceSnapshot,
    linkType,
  };

  await db.traceLinks.add(link);
  return link;
}

export async function getTraceLinksForRecord(recordId: string): Promise<TraceLink[]> {
  return db.traceLinks.where('recordId').equals(recordId).toArray();
}

export async function buildTraceChain(record: SightRecord): Promise<TraceChain> {
  const links = await getTraceLinksForRecord(record.id);
  const chain: TraceChain = {
    record,
    links: [],
  };

  for (const link of links) {
    let data: DeviceRemark | CADPoint | null = null;
    let history: RemarkHistory[] | undefined;

    if (link.sourceType === 'device-remark') {
      data = await db.deviceRemarks.get(link.sourceId) || null;
      if (data) {
        history = await db.remarkHistories
          .where('remarkId')
          .equals(data.id)
          .reverse()
          .sortBy('modifiedAt');
      }
    } else if (link.sourceType === 'cad-point') {
      data = await db.cadPoints.get(link.sourceId) || null;
    }

    chain.links.push({
      type: link.sourceType,
      data,
      history,
    });
  }

  return chain;
}

export async function createTraceLinksForRecord(
  record: SightRecord,
  deviceRemarkId?: string,
  cadPointId?: string,
  manualSnapshot?: Record<string, unknown>
): Promise<void> {
  const links: Omit<TraceLink, 'id'>[] = [];

  if (deviceRemarkId) {
    const remark = await db.deviceRemarks.get(deviceRemarkId);
    if (remark) {
      links.push({
        recordId: record.id,
        sourceType: 'device-remark',
        sourceId: remark.id,
        sourceSnapshot: {
          deviceCode: remark.deviceCode,
          deviceName: remark.deviceName,
          content: remark.content,
          coordinate: remark.coordinate,
          modifier: remark.modifier,
          modifiedAt: remark.modifiedAt,
        },
        linkType: 'primary',
      });
    }
  }

  if (cadPointId) {
    const point = await db.cadPoints.get(cadPointId);
    if (point) {
      links.push({
        recordId: record.id,
        sourceType: 'cad-point',
        sourceId: point.id,
        sourceSnapshot: {
          pointCode: point.pointCode,
          pointName: point.pointName,
          x: point.x,
          y: point.y,
          z: point.z,
          source: point.source,
          importer: point.importer,
          importedAt: point.importedAt,
          hasFlip: point.hasFlip,
          flipType: point.flipType,
        },
        linkType: 'secondary',
      });
    }
  }

  if (manualSnapshot) {
    links.push({
      recordId: record.id,
      sourceType: 'manual-input',
      sourceId: `manual-${Date.now()}`,
      sourceSnapshot: manualSnapshot,
      linkType: 'manual',
    });
  }

  const traceLinks: TraceLink[] = links.map((l) => ({
    ...l,
    id: `trace-${generateId()}`,
  }));

  if (traceLinks.length > 0) {
    await db.traceLinks.bulkAdd(traceLinks);
  }
}

export function formatTraceSource(sourceType: TraceSourceType): string {
  const labels: Record<TraceSourceType, string> = {
    'device-remark': '设备备注',
    'cad-point': 'CAD点位',
    'manual-input': '人工输入',
  };
  return labels[sourceType];
}

export function getTraceIconType(sourceType: TraceSourceType): 'device' | 'cad' | 'user' {
  const icons: Record<TraceSourceType, 'device' | 'cad' | 'user'> = {
    'device-remark': 'device',
    'cad-point': 'cad',
    'manual-input': 'user',
  };
  return icons[sourceType];
}

export function getBreadcrumbForChain(chain: TraceChain): Array<{ label: string; type: TraceSourceType }> {
  const crumbs: Array<{ label: string; type: TraceSourceType }> = [
    { label: chain.record.deviceName, type: chain.record.traceSource },
  ];

  for (const link of chain.links) {
    if (link.data) {
      if ('deviceCode' in link.data) {
        crumbs.push({ label: link.data.deviceCode, type: 'device-remark' });
      } else if ('pointCode' in link.data) {
        crumbs.push({ label: link.data.pointCode, type: 'cad-point' });
      }
    }
  }

  return crumbs;
}
