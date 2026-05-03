export function timeToSeconds(timeStr: string): number {
  const srtMatch = timeStr.match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/);
  if (srtMatch) {
    const hours = parseInt(srtMatch[1], 10);
    const minutes = parseInt(srtMatch[2], 10);
    const seconds = parseInt(srtMatch[3], 10);
    const milliseconds = parseInt(srtMatch[4], 10);
    return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
  }

  const vttMatch = timeStr.match(/(\d{2}):(\d{2})[,.](\d{3})/);
  if (vttMatch) {
    const minutes = parseInt(vttMatch[1], 10);
    const seconds = parseInt(vttMatch[2], 10);
    const milliseconds = parseInt(vttMatch[3], 10);
    return minutes * 60 + seconds + milliseconds / 1000;
  }

  const hmsMatch = timeStr.match(/(\d{2}):(\d{2}):(\d{2})/);
  if (hmsMatch) {
    const hours = parseInt(hmsMatch[1], 10);
    const minutes = parseInt(hmsMatch[2], 10);
    const seconds = parseInt(hmsMatch[3], 10);
    return hours * 3600 + minutes * 60 + seconds;
  }

  const msMatch = timeStr.match(/(\d{2}):(\d{2})/);
  if (msMatch) {
    const minutes = parseInt(msMatch[1], 10);
    const seconds = parseInt(msMatch[2], 10);
    return minutes * 60 + seconds;
  }

  throw new Error(`无法解析时间格式: ${timeStr}`);
}

export function secondsToTime(seconds: number, format: 'srt' | 'vtt' | 'simple' = 'srt'): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const milliseconds = Math.floor((seconds * 1000) % 1000);

  if (format === 'srt') {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`;
  } else if (format === 'vtt') {
    if (hours > 0) {
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
    }
    return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
  } else {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
}

export function formatTimeForDisplay(seconds: number): string {
  return secondsToTime(seconds, 'simple');
}

export function isTimeOverlapping(
  start1: number,
  end1: number,
  start2: number,
  end2: number
): boolean {
  return start1 < end2 && start2 < end1;
}

export function getOverlapDuration(
  start1: number,
  end1: number,
  start2: number,
  end2: number
): number {
  if (!isTimeOverlapping(start1, end1, start2, end2)) {
    return 0;
  }
  const overlapStart = Math.max(start1, start2);
  const overlapEnd = Math.min(end1, end2);
  return overlapEnd - overlapStart;
}
