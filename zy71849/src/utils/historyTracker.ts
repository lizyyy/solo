import { db } from '@/db';
import { generateId } from '@/db/seed';
import { DeviceRemark, RemarkHistory, Coordinate, ChangeDiff } from '@/types';

function compareCoordinates(oldCoord: Coordinate, newCoord: Coordinate): ChangeDiff<Coordinate> {
  const changed = oldCoord.x !== newCoord.x || oldCoord.y !== newCoord.y || oldCoord.z !== newCoord.z;
  return {
    oldValue: oldCoord,
    newValue: newCoord,
    changed,
  };
}

function compareContent(oldContent: string, newContent: string): ChangeDiff<string> {
  return {
    oldValue: oldContent,
    newValue: newContent,
    changed: oldContent !== newContent,
  };
}

export function hasChanges(oldRemark: DeviceRemark, newContent: string, newCoordinate: Coordinate): boolean {
  const contentDiff = compareContent(oldRemark.content, newContent);
  const coordDiff = compareCoordinates(oldRemark.coordinate, newCoordinate);
  return contentDiff.changed || coordDiff.changed;
}

export async function trackRemarkChange(
  remarkId: string,
  oldContent: string,
  newContent: string,
  oldCoordinate: Coordinate,
  newCoordinate: Coordinate,
  modifier: string,
  changeReason: string
): Promise<RemarkHistory | null> {
  const contentDiff = compareContent(oldContent, newContent);
  const coordDiff = compareCoordinates(oldCoordinate, newCoordinate);

  if (!contentDiff.changed && !coordDiff.changed) {
    return null;
  }

  const history: RemarkHistory = {
    id: `hist-${generateId()}`,
    remarkId,
    oldContent: contentDiff.oldValue,
    newContent: contentDiff.newValue,
    oldCoordinate: coordDiff.oldValue,
    newCoordinate: coordDiff.newValue,
    modifier,
    modifiedAt: new Date(),
    changeReason,
  };

  await db.remarkHistories.add(history);
  return history;
}

export async function getRemarkHistories(remarkId: string): Promise<RemarkHistory[]> {
  return db.remarkHistories
    .where('remarkId')
    .equals(remarkId)
    .reverse()
    .sortBy('modifiedAt');
}

export function formatChangeSummary(history: RemarkHistory): string {
  const changes: string[] = [];

  if (history.oldContent !== history.newContent) {
    changes.push('备注内容');
  }

  const coordChanged =
    history.oldCoordinate.x !== history.newCoordinate.x ||
    history.oldCoordinate.y !== history.newCoordinate.y ||
    history.oldCoordinate.z !== history.newCoordinate.z;

  if (coordChanged) {
    const axisChanges: string[] = [];
    if (history.oldCoordinate.x !== history.newCoordinate.x) axisChanges.push('X');
    if (history.oldCoordinate.y !== history.newCoordinate.y) axisChanges.push('Y');
    if (history.oldCoordinate.z !== history.newCoordinate.z) axisChanges.push('Z');
    changes.push(`${axisChanges.join('/')}轴坐标`);
  }

  return changes.join('、');
}

export function formatCoordinateDiff(history: RemarkHistory): { x: ChangeDiff<number>; y: ChangeDiff<number>; z: ChangeDiff<number> } {
  return {
    x: {
      oldValue: history.oldCoordinate.x,
      newValue: history.newCoordinate.x,
      changed: history.oldCoordinate.x !== history.newCoordinate.x,
    },
    y: {
      oldValue: history.oldCoordinate.y,
      newValue: history.newCoordinate.y,
      changed: history.oldCoordinate.y !== history.newCoordinate.y,
    },
    z: {
      oldValue: history.oldCoordinate.z,
      newValue: history.newCoordinate.z,
      changed: history.oldCoordinate.z !== history.newCoordinate.z,
    },
  };
}
