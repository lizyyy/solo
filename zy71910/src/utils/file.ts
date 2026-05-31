export async function calculateFileHash(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function parseSRT(content: string): Array<{ startTime: number; endTime: number; text: string }> {
  const blocks = content.trim().split(/\n\s*\n/);
  const segments: Array<{ startTime: number; endTime: number; text: string }> = [];

  for (const block of blocks) {
    const lines = block.split('\n');
    if (lines.length >= 3) {
      const timeMatch = lines[1].match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
      if (timeMatch) {
        const startTime = 
          parseInt(timeMatch[1]) * 3600 +
          parseInt(timeMatch[2]) * 60 +
          parseInt(timeMatch[3]) +
          parseInt(timeMatch[4]) / 1000;
        const endTime =
          parseInt(timeMatch[5]) * 3600 +
          parseInt(timeMatch[6]) * 60 +
          parseInt(timeMatch[7]) +
          parseInt(timeMatch[8]) / 1000;
        const text = lines.slice(2).join(' ').trim();
        segments.push({ startTime, endTime, text });
      }
    }
  }

  return segments;
}

export function parsePlainText(content: string): Array<{ startTime: number; endTime: number; text: string }> {
  const lines = content.split('\n').filter(l => l.trim());
  const segments: Array<{ startTime: number; endTime: number; text: string }> = [];
  let currentTime = 0;

  for (const line of lines) {
    const duration = Math.max(2, line.length / 5);
    segments.push({
      startTime: currentTime,
      endTime: currentTime + duration,
      text: line.trim()
    });
    currentTime += duration + 0.2;
  }

  return segments;
}
