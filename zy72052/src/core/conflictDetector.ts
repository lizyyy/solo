import { Point, Photo, Scheme, ConflictEvidence } from '@/types';

function parseCoordStr(s: string): [number, number, number] | null {
  const m = s.match(/\(?\s*([\d.-]+)\s*,\s*([\d.-]+)\s*,\s*([\d.-]+)\s*\)?/);
  if (!m) return null;
  return [parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3])];
}

function coordsMatch(a: string, b: string, tolerance = 0.05): boolean {
  const ca = parseCoordStr(a);
  const cb = parseCoordStr(b);
  if (!ca || !cb) return false;
  return Math.abs(ca[0] - cb[0]) <= tolerance &&
         Math.abs(ca[1] - cb[1]) <= tolerance &&
         Math.abs(ca[2] - cb[2]) <= tolerance;
}

export function detectConflicts(
  points: Point[],
  photos: Photo[],
  schemes: Scheme[]
): ConflictEvidence[] {
  const conflicts: ConflictEvidence[] = [];

  for (const point of points) {
    if (point.x === null || point.y === null || point.z === null) continue;

    const relatedPhotos = photos.filter(p => p.pointId === point.id);
    const relatedSchemes = schemes.filter(s => s.pointId === point.id);

    const tableCoord = `(${point.x}, ${point.y}, ${point.z})`;
    const photoCoord = relatedPhotos.length > 0 ? relatedPhotos[0].markedCoordinates : undefined;
    const schemeCoord = relatedSchemes.length > 0
      ? `(${relatedSchemes[0].coordinates.x}, ${relatedSchemes[0].coordinates.y}, ${relatedSchemes[0].coordinates.z})`
      : undefined;
    const manualCoord = point.manualCoord
      ? `(${point.manualCoord.x}, ${point.manualCoord.y}, ${point.manualCoord.z})`
      : undefined;

    let hasRealConflict = false;

    if (photoCoord && !coordsMatch(tableCoord, photoCoord)) {
      hasRealConflict = true;
    }
    if (manualCoord && !coordsMatch(tableCoord, manualCoord)) {
      hasRealConflict = true;
    }
    if (schemeCoord && !coordsMatch(tableCoord, schemeCoord)) {
      hasRealConflict = true;
    }
    if (photoCoord && manualCoord && !coordsMatch(photoCoord, manualCoord)) {
      hasRealConflict = true;
    }

    if (hasRealConflict || point.conflictWithPhoto) {
      const suggestedAction = buildSuggestedAction(point, photoCoord, manualCoord, schemeCoord);
      const friendlyMessage = buildFriendlyMessage(point, photoCoord, manualCoord, schemeCoord);

      conflicts.push({
        pointId: point.id,
        pointName: point.name,
        photoCoord,
        tableCoord,
        manualCoord,
        schemeCoord,
        suggestedAction,
        friendlyMessage
      });
    }
  }

  return conflicts;
}

function buildSuggestedAction(
  point: Point,
  photoCoord?: string,
  manualCoord?: string,
  schemeCoord?: string
): string {
  const actions: string[] = [];

  if (photoCoord && manualCoord) {
    actions.push('照片标注与手改坐标不一致，建议到现场重新测量确认');
  } else if (photoCoord) {
    actions.push('照片标注与点位表不一致，建议核对巡检照片原始记录');
  }

  if (manualCoord && point.manualCoord) {
    actions.push(`手改坐标由${point.manualCoord.modifiedBy}修改，原因："${point.manualCoord.reason}"，建议与修改人确认`);
  }

  if (schemeCoord) {
    actions.push('方案坐标与现场数据有出入，建议核对方案版本是否为最新');
  }

  return actions.length > 0 ? actions.join('；') : '请核对数据来源';
}

function buildFriendlyMessage(
  point: Point,
  photoCoord?: string,
  manualCoord?: string,
  schemeCoord?: string
): string {
  const tableCoord = point.x !== null && point.y !== null && point.z !== null
    ? `(${point.x}, ${point.y}, ${point.z})`
    : '坐标缺失';

  let msg = `哎，${point.name}这点位，`;

  if (photoCoord) {
    msg += `照片里标在${photoCoord}，但点位表写的是${tableCoord}`;
  }

  if (manualCoord) {
    msg += `，${point.manualCoord?.modifiedBy || '有人'}手改成了${manualCoord}`;
  }

  if (schemeCoord) {
    msg += `，方案里是${schemeCoord}`;
  }

  msg += '——几个数对不上，你再核对下？';

  return msg;
}
