import { msToTime } from '../types.js';

export function parseSRT(content) {
  const subtitles = [];
  const blocks = content.trim().split(/\n\n+/);
  
  for (const block of blocks) {
    const lines = block.split('\n');
    if (lines.length < 3) continue;
    
    const id = parseInt(lines[0], 10);
    if (isNaN(id)) continue;
    
    const timeMatch = lines[1].match(/(\d{2}:\d{2}:\d{2}[,\.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,\.]\d{3})/);
    if (!timeMatch) continue;
    
    const startTimeStr = timeMatch[1].replace(',', '.');
    const endTimeStr = timeMatch[2].replace(',', '.');
    
    const startTime = srtTimeToMs(timeMatch[1]);
    const endTime = srtTimeToMs(timeMatch[2]);
    
    const text = lines.slice(2).join('\n').trim();
    
    subtitles.push({
      id,
      startTime,
      endTime,
      startTimeStr: timeMatch[1],
      endTimeStr: timeMatch[2],
      text,
      duration: endTime - startTime
    });
  }
  
  return subtitles;
}

function srtTimeToMs(timeStr) {
  const normalized = timeStr.replace(',', '.');
  const parts = normalized.split(':');
  const lastParts = parts[2].split('.');
  
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  const seconds = parseInt(lastParts[0], 10);
  const milliseconds = parseInt(lastParts[1] || '0', 10);
  
  return hours * 3600000 + minutes * 60000 + seconds * 1000 + milliseconds;
}

export function serializeSRT(subtitles) {
  return subtitles
    .sort((a, b) => a.id - b.id)
    .map((sub, index) => {
      return `${index + 1}\n${sub.startTimeStr} --> ${sub.endTimeStr}\n${sub.text}\n`;
    })
    .join('\n');
}
