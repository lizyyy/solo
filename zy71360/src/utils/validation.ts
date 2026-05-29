import type { Shot } from '@/types';

export function parseShotNumber(shotNumber: string): {
  scene: string;
  sequence: number;
  valid: boolean;
} {
  const match = shotNumber.match(/^S(\d+)-E(\d+)$/);
  if (!match) return { scene: '', sequence: 0, valid: false };
  return {
    scene: `S${match[1].padStart(2, '0')}`,
    sequence: parseInt(match[2], 10),
    valid: true,
  };
}

export function formatShotNumber(scene: number, sequence: number): string {
  return `S${scene.toString().padStart(2, '0')}-E${sequence.toString().padStart(3, '0')}`;
}

export function validateShotNumber(
  shotNumber: string,
  shots: Shot[],
  excludeShotId?: string
): { valid: boolean; conflicts: Shot[]; message: string } {
  const parsed = parseShotNumber(shotNumber);
  
  if (!parsed.valid) {
    return {
      valid: false,
      conflicts: [],
      message: '镜头号格式错误，应为 S01-E012 格式',
    };
  }

  const conflicts = shots.filter(
    (shot) => shot.shotNumber === shotNumber && shot.id !== excludeShotId
  );

  if (conflicts.length > 0) {
    return {
      valid: false,
      conflicts,
      message: `镜头号 ${shotNumber} 已被使用`,
    };
  }

  return {
    valid: true,
    conflicts: [],
    message: '',
  };
}

export function isLocked(shot: Shot): boolean {
  return shot.status === 'locked';
}

export function canEdit(shot: Shot, userRole: string): boolean {
  if (shot.status === 'locked') {
    return userRole === 'director';
  }
  return userRole !== 'viewer';
}

export function canLock(shot: Shot, userRole: string): boolean {
  return userRole === 'director' && shot.status !== 'locked';
}

export function canUnlock(shot: Shot, userRole: string): boolean {
  return userRole === 'director' && shot.status === 'locked';
}

export function canRollback(userRole: string): boolean {
  return userRole === 'director';
}
