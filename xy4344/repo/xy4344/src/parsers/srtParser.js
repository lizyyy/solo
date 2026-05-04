const fs = require('fs');
const path = require('path');

function parseTime(timeStr) {
  const parts = timeStr.split(':');
  const hours = parseInt(parts[0]);
  const minutes = parseInt(parts[1]);
  const secondsParts = parts[2].split(',');
  const seconds = parseInt(secondsParts[0]);
  const milliseconds = parseInt(secondsParts[1] || 0);
  
  return hours * 3600000 + minutes * 60000 + seconds * 1000 + milliseconds;
}

function formatTime(ms) {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = ms % 1000;
  
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`;
}

function parseSRT(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const blocks = content.trim().split(/\n\n+/);
  
  const subtitles = [];
  
  for (const block of blocks) {
    const lines = block.split('\n');
    if (lines.length < 3) continue;
    
    const index = parseInt(lines[0]);
    const timeMatch = lines[1].match(/(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/);
    
    if (!timeMatch) continue;
    
    const startTime = parseTime(timeMatch[1]);
    const endTime = parseTime(timeMatch[2]);
    const text = lines.slice(2).join(' ').trim();
    
    subtitles.push({
      index,
      startTime,
      endTime,
      startTimeStr: timeMatch[1],
      endTimeStr: timeMatch[2],
      text,
      duration: endTime - startTime,
      sourceFile: path.basename(filePath)
    });
  }
  
  return subtitles;
}

module.exports = {
  parseSRT,
  parseTime,
  formatTime
};
