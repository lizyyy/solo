function parse(content) {
  const subtitles = [];
  const blocks = content.trim().split(/\n\n+/);
  
  blocks.forEach((block, index) => {
    const lines = block.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) return;
    
    let sequence = index + 1;
    let timeLineIndex = 0;
    
    if (/^\d+$/.test(lines[0].trim())) {
      sequence = parseInt(lines[0].trim());
      timeLineIndex = 1;
    }
    
    if (timeLineIndex >= lines.length) return;
    
    const timeLine = lines[timeLineIndex];
    const timeMatch = timeLine.match(/(\d{2}:\d{2}:\d{2}[,\.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,\.]\d{3})/);
    
    if (!timeMatch) return;
    
    const startTime = timeMatch[1].replace(',', '.');
    const endTime = timeMatch[2].replace(',', '.');
    
    const startSeconds = timeToSeconds(startTime);
    const endSeconds = timeToSeconds(endTime);
    
    const textLines = lines.slice(timeLineIndex + 1);
    let text = textLines.join(' ').trim();
    let speaker = null;
    
    const speakerMatch = text.match(/^([^\s:]+):\s*(.*)$/);
    if (speakerMatch) {
      speaker = speakerMatch[1];
      text = speakerMatch[2];
    }
    
    subtitles.push({
      sequence,
      startTime: startTime.replace('.', ','),
      endTime: endTime.replace('.', ','),
      startSeconds,
      endSeconds,
      text,
      speaker
    });
  });
  
  return subtitles.sort((a, b) => a.sequence - b.sequence);
}

function timeToSeconds(timeStr) {
  const parts = timeStr.split(':');
  const hours = parseInt(parts[0]);
  const minutes = parseInt(parts[1]);
  const secondsParts = parts[2].split(/[,\.]/);
  const seconds = parseInt(secondsParts[0]);
  const milliseconds = parseInt(secondsParts[1] || '000');
  
  return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
}

function secondsToTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const milliseconds = Math.floor((seconds % 1) * 1000);
  
  return `${padZero(hours, 2)}:${padZero(minutes, 2)}:${padZero(secs, 2)},${padZero(milliseconds, 3)}`;
}

function padZero(num, length) {
  return num.toString().padStart(length, '0');
}

module.exports = {
  parse,
  timeToSeconds,
  secondsToTime
};