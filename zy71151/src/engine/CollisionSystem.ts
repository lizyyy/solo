import { Ship, Tug, CollisionWarning } from '../types';
import { distance } from '../utils/math';
export class CollisionSystem {
  static WARNING_DISTANCE = 8;
  static CRITICAL_DISTANCE = 4;
  static COLLISION_DISTANCE = 2;
  static detectWarnings(
    ships: Ship[],
    tugs: Tug[],
    currentTime: number
  ): {
    warnings: CollisionWarning[];
    hasCollision: boolean;
    collisionPair?: [string, string];
  } {
    const warnings: CollisionWarning[] = [];
    let hasCollision = false;
    let collisionPair: [string, string] | undefined;
    for (let i = 0; i < tugs.length; i++) {
      for (let j = i + 1; j < tugs.length; j++) {
        const dist = distance(tugs[i].position, tugs[j].position);
        if (dist <= this.COLLISION_DISTANCE) {
          hasCollision = true;
          collisionPair = [tugs[i].id, tugs[j].id];
        } else if (dist <= this.CRITICAL_DISTANCE) {
          warnings.push({
            id: `${tugs[i].id}-${tugs[j].id}`,
            time: currentTime,
            object1Id: tugs[i].id,
            object2Id: tugs[j].id,
            distance: dist,
            severity: 'critical',
          });
        } else if (dist <= this.WARNING_DISTANCE) {
          warnings.push({
            id: `${tugs[i].id}-${tugs[j].id}`,
            time: currentTime,
            object1Id: tugs[i].id,
            object2Id: tugs[j].id,
            distance: dist,
            severity: 'warning',
          });
        }
      }
    }
    for (const tug of tugs) {
      for (const ship of ships) {
        if (tug.assignedShipId === ship.id)
          continue;
        const dist = distance(tug.position, ship.position);
        if (dist <= this.COLLISION_DISTANCE + ship.length / 4) {
          hasCollision = true;
          collisionPair = [tug.id, ship.id];
        }
        else if (dist <= this.CRITICAL_DISTANCE + ship.length / 4) {
          warnings.push({
            id: `${tug.id}-${ship.id}`,
            time: currentTime,
            object1Id: tug.id,
            object2Id: ship.id,
            distance: dist,
            severity: 'critical',
          });
        }
        else if (dist <= this.WARNING_DISTANCE + ship.length / 4) {
          warnings.push({
            id: `${tug.id}-${ship.id}`,
            time: currentTime,
            object1Id: tug.id,
            object2Id: ship.id,
            distance: dist,
            severity: 'warning',
          });
        }
      }
    }
    for (let i = 0; i < ships.length; i++) {
      for (let j = i + 1; j < ships.length; j++) {
        if (ships[i].status === 'docked' && ships[j].status === 'docked')
          continue;
        const dist = distance(ships[i].position, ships[j].position);
        const safeDist = (ships[i].length + ships[j].length) / 2;
        if (dist <= safeDist * 0.3) {
          hasCollision = true;
          collisionPair = [ships[i].id, ships[j].id];
        }
        else if (dist <= safeDist * 0.5) {
          warnings.push({
            id: `${ships[i].id}-${ships[j].id}`,
            time: currentTime,
            object1Id: ships[i].id,
            object2Id: ships[j].id,
            distance: dist,
            severity: 'critical',
          });
        }
        else if (dist <= safeDist * 0.8) {
          warnings.push({
            id: `${ships[i].id}-${ships[j].id}`,
            time: currentTime,
            object1Id: ships[i].id,
            object2Id: ships[j].id,
            distance: dist,
            severity: 'warning',
          });
        }
      }
    }
    return { warnings, hasCollision, collisionPair };
  }
}

