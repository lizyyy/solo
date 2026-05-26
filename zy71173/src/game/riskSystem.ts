import type {
  Level,
  Position,
  Door,
  Guard,
  CardType,
  GameEvent,
  GameEventType,
  HumidityRiskResult,
  CongestionRiskResult,
  PermissionResult,
  GuardUpdateResult,
} from './types';

const HUMIDITY_DAMAGE_THRESHOLD = 70;
const HUMIDITY_BASE_DAMAGE = 100;
const CONGESTION_THRESHOLD = 3;
const GUARD_DETECTION_RANGE = 2;

function getDistance(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function checkHumidityZones(level: Level, position: Position): number {
  let maxHumidity = level.humidity;
  for (const zone of level.humidityZones) {
    const distance = getDistance(zone.position, position);
    if (distance <= zone.radius) {
      const humidityInfluence = zone.humidity * (1 - distance / (zone.radius + 1));
      maxHumidity = Math.max(maxHumidity, level.humidity + humidityInfluence);
    }
  }
  return maxHumidity;
}

function checkCongestionZones(level: Level, position: Position, round: number): number {
  let congestionLevel = 0;
  for (const zone of level.congestionZones) {
    if (zone.activeRounds.includes(round) && getDistance(zone.position, position) <= 1) {
      congestionLevel += 2;
    }
  }
  return congestionLevel;
}

export function checkHumidityRisk(
  level: Level,
  position: Position,
  round: number
): HumidityRiskResult {
  const baseHumidity = checkHumidityZones(level, position);
  const humidity = baseHumidity + round * 2;
  const risk = humidity >= HUMIDITY_DAMAGE_THRESHOLD;
  const damage = risk ? Math.floor((humidity - HUMIDITY_DAMAGE_THRESHOLD) / 10) * 50 + HUMIDITY_BASE_DAMAGE : 0;

  return {
    risk,
    humidity,
    damage,
  };
}

export function checkCongestionRisk(
  level: Level,
  position: Position,
  round: number
): CongestionRiskResult {
  let congestionLevel = checkCongestionZones(level, position, round);

  for (const guard of level.guards) {
    if (getDistance(guard.position, position) <= 1) {
      congestionLevel++;
    }
  }

  const nearbyDoors = level.doors.filter(
    (door) => getDistance(door.position, position) <= 1 && !door.isOpen
  );
  congestionLevel += nearbyDoors.length;

  if (round > level.maxRounds * 0.7) {
    congestionLevel += 1;
  }

  return {
    risk: congestionLevel >= CONGESTION_THRESHOLD,
    congestionLevel,
  };
}

export function checkDoorPermission(
  door: Door,
  availableCards: CardType[]
): PermissionResult {
  const hasCard = availableCards.includes(door.requiredCard);
  return {
    allowed: hasCard,
    missingCard: hasCard ? undefined : door.requiredCard,
  };
}

export function updateGuard(
  guard: Guard,
  playerPos: Position
): GuardUpdateResult {
  const nextIndex = (guard.currentPathIndex + 1) % guard.patrolPath.length;
  const newPosition = guard.patrolPath[nextIndex];

  const distance = getDistance(newPosition, playerPos);
  const spotted = distance <= GUARD_DETECTION_RANGE || distance <= guard.visionRange;

  const updatedGuard: Guard = {
    ...guard,
    position: newPosition,
    currentPathIndex: nextIndex,
    patrolIndex: nextIndex,
    isAlerted: spotted || guard.isAlerted,
  };

  return {
    guard: updatedGuard,
    spotted,
  };
}

export function processPosition(
  level: Level,
  position: Position,
  round: number,
  availableCards: CardType[]
): GameEvent[] {
  const events: GameEvent[] = [];

  const humidityResult = checkHumidityRisk(level, position, round);
  if (humidityResult.risk) {
    events.push({
      round,
      type: 'humidity_damage' as GameEventType,
      position,
      description: `湿度过高！当前湿度: ${humidityResult.humidity}%，造成 ${humidityResult.damage} 点伤害`,
      scoreChange: -humidityResult.damage,
      data: { humidity: humidityResult.humidity, damage: humidityResult.damage },
    });
  }

  const congestionResult = checkCongestionRisk(level, position, round);
  if (congestionResult.risk) {
    events.push({
      round,
      type: 'congestion' as GameEventType,
      position,
      description: `区域拥堵！拥堵等级: ${congestionResult.congestionLevel}`,
      scoreChange: -50,
      data: { congestionLevel: congestionResult.congestionLevel },
    });
  }

  const currentDoor = level.doors.find(
    (door) => door.position.x === position.x && door.position.y === position.y
  );
  if (currentDoor && !currentDoor.isOpen) {
    const permissionResult = checkDoorPermission(currentDoor, availableCards);
    if (!permissionResult.allowed) {
      events.push({
        round,
        type: 'door_permission_denied' as GameEventType,
        position,
        description: `门禁权限不足！需要 ${permissionResult.missingCard} 卡`,
        scoreChange: -100,
        data: { doorId: currentDoor.id, missingCard: permissionResult.missingCard },
      });
    }
  }

  return events;
}
