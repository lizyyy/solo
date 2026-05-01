import fs from 'fs';

export function parseSRT(srtPath) {
  if (!fs.existsSync(srtPath)) {
    throw new Error(`SRT 文件不存在: ${srtPath}`);
  }
  const content = fs.readFileSync(srtPath, 'utf-8');
  const lines = content.split('\n');
  const subtitles = [];
  let i = 0;
  
  while (i < lines.length) {
    const index = parseInt(lines[i].trim());
    if (isNaN(index)) {
      i++;
      continue;
    }
    
    i++;
    const timeLine = lines[i]?.trim();
    if (!timeLine) {
      i++;
      continue;
    }
    
    const [start, end] = timeLine.split('-->');
    i++;
    
    let text = '';
    while (i < lines.length && lines[i].trim()) {
      text += (text ? '\n' : '') + lines[i].trim();
      i++;
    }
    
    subtitles.push({
      index,
      start: parseTimecode(start.trim()),
      end: parseTimecode(end.trim()),
      text
    });
    
    i++;
  }
  
  return subtitles;
}

function parseTimecode(timecode) {
  const parts = timecode.split(':');
  const [hours, minutes, secondsMs] = parts;
  const [seconds, milliseconds] = secondsMs.split(',');
  return parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds) + parseInt(milliseconds) / 1000;
}

export function getSRTTotalDuration(subtitles) {
  if (subtitles.length === 0) return 0;
  return Math.max(...subtitles.map(s => s.end));
}