
import { ModelElement } from '../types/model';
import { VersionDiff, ElementChange, ChangeType } from '../types/version';

export function compareVersions(
  elementsV1: ModelElement[],
  elementsV2: ModelElement[],
  versionA: number,
  versionB: number
): VersionDiff {
  const changes: ElementChange[] = [];
  const allIds = new Set([
    ...elementsV1.map(e => e.id),
    ...elementsV2.map(e => e.id)
  ]);

  allIds.forEach(id => {
    const oldEl = elementsV1.find(e => e.id === id);
    const newEl = elementsV2.find(e => e.id === id);

    if (!oldEl && newEl) {
      changes.push({
        elementId: id,
        type: 'added',
        newElement: newEl
      });
    } else if (oldEl && !newEl) {
      changes.push({
        elementId: id,
        type: 'removed',
        oldElement: oldEl
      });
    } else if (oldEl && newEl) {
      const elementChanges = compareElements(oldEl, newEl);
      if (elementChanges.length > 0) {
        changes.push({
          elementId: id,
          type: 'modified',
          oldElement: oldEl,
          newElement: newEl,
          changes: elementChanges
        });
      } else {
        changes.push({
          elementId: id,
          type: 'unchanged',
          oldElement: oldEl,
          newElement: newEl
        });
      }
    }
  });

  return {
    versionA,
    versionB,
    changes,
    statistics: {
      added: changes.filter(c => c.type === 'added').length,
      removed: changes.filter(c => c.type === 'removed').length,
      modified: changes.filter(c => c.type === 'modified').length,
      unchanged: changes.filter(c => c.type === 'unchanged').length
    }
  };
}

function compareElements(oldEl: ModelElement, newEl: ModelElement) {
  const changes: { property: string; oldValue: any; newValue: any }[] = [];

  if (oldEl.elevation !== newEl.elevation) {
    changes.push({
      property: 'elevation',
      oldValue: oldEl.elevation,
      newValue: newEl.elevation
    });
  }

  if (oldEl.radius !== newEl.radius) {
    changes.push({
      property: 'radius',
      oldValue: oldEl.radius,
      newValue: newEl.radius
    });
  }

  if (oldEl.name !== newEl.name) {
    changes.push({
      property: 'name',
      oldValue: oldEl.name,
      newValue: newEl.name
    });
  }

  if (JSON.stringify(oldEl.points) !== JSON.stringify(newEl.points)) {
    changes.push({
      property: 'geometry',
      oldValue: '已修改',
      newValue: '已修改'
    });
  }

  return changes;
}

export function getChangeColor(type: ChangeType): string {
  switch (type) {
    case 'added': return '#00B42A';
    case 'removed': return '#F53F3F';
    case 'modified': return '#FF7D00';
    default: return '#86909C';
  }
}

export function getChangeLabel(type: ChangeType): string {
  switch (type) {
    case 'added': return '新增';
    case 'removed': return '删除';
    case 'modified': return '修改';
    default: return '未变';
  }
}
