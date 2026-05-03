export function parseTime(timeStr: string): number {
  const hmsMatch = timeStr.match(/^(\d+):(\d+):(\d+)(?:\.(\d+))?$/);
  if (hmsMatch) {
    const hours = parseInt(hmsMatch[1], 10);
    const minutes = parseInt(hmsMatch[2], 10);
    const seconds = parseInt(hmsMatch[3], 10);
    const milliseconds = hmsMatch[4] ? parseInt(hmsMatch[4].padEnd(3, '0'), 10) : 0;
    return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
  }

  const msMatch = timeStr.match(/^(\d+):(\d+)(?:\.(\d+))?$/);
  if (msMatch) {
    const minutes = parseInt(msMatch[1], 10);
    const seconds = parseInt(msMatch[2], 10);
    const milliseconds = msMatch[3] ? parseInt(msMatch[3].padEnd(3, '0'), 10) : 0;
    return minutes * 60 + seconds + milliseconds / 1000;
  }

  const secondsMatch = timeStr.match(/^(\d+)(?:\.(\d+))?$/);
  if (secondsMatch) {
    const seconds = parseInt(secondsMatch[1], 10);
    const milliseconds = secondsMatch[2] ? parseInt(secondsMatch[2].padEnd(3, '0'), 10) : 0;
    return seconds + milliseconds / 1000;
  }

  throw new Error(`无法解析时间格式: ${timeStr}。支持格式: HH:MM:SS.mmm, MM:SS.mmm, SS.mmm`);
}

export function formatTime(seconds: number): string {
  const isNegative = seconds < 0;
  const absSeconds = Math.abs(seconds);
  
  const hours = Math.floor(absSeconds / 3600);
  const minutes = Math.floor((absSeconds % 3600) / 60);
  const secs = (absSeconds % 60).toFixed(3);

  if (hours > 0) {
    return `${isNegative ? '-' : ''}${hours}:${minutes.toString().padStart(2, '0')}:${secs.padStart(6, '0')}`;
  }
  
  return `${isNegative ? '-' : ''}${minutes}:${secs.padStart(6, '0')}`;
}

export function isValidTimeFormat(timeStr: string): boolean {
  try {
    parseTime(timeStr);
    return true;
  } catch {
    return false;
  }
}
