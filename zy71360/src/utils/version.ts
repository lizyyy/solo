import type { ShotVersion } from '@/types';

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function getNextVersion(
  currentVersion: ShotVersion,
  isMajorChange: boolean
): { major: number; minor: number; versionString: string } {
  if (isMajorChange) {
    return {
      major: currentVersion.majorVersion + 1,
      minor: 0,
      versionString: `${currentVersion.majorVersion + 1}.0`,
    };
  } else {
    return {
      major: currentVersion.majorVersion,
      minor: currentVersion.minorVersion + 1,
      versionString: `${currentVersion.majorVersion}.${currentVersion.minorVersion + 1}`,
    };
  }
}

export function getInitialVersion(): { major: number; minor: number; versionString: string } {
  return {
    major: 1,
    minor: 0,
    versionString: '1.0',
  };
}

export function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatTimecode(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${ms.toString().padStart(2, '0')}`;
}
