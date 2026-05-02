import { timeToMs, ClipType } from '../types.js';

export function parseAdSchedule(content) {
  if (content.includes(',') && !content.includes('\t')) {
    return parseCSVAdSchedule(content);
  }
  if (content.includes('\t')) {
    return parseTSVAdSchedule(content);
  }
  return parseTextAdSchedule(content);
}

function parseCSVAdSchedule(content) {
  const lines = content.trim().split('\n');
  const ads = [];
  
  const header = lines[0].toLowerCase();
  const hasHeader = header.includes('时间') || header.includes('time') || 
                    header.includes('位置') || header.includes('position');
  
  const startIndex = hasHeader ? 1 : 0;
  
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const ad = parseAdLine(line, i - startIndex + 1);
    if (ad) {
      ads.push(ad);
    }
  }
  
  return ads;
}

function parseTSVAdSchedule(content) {
  return parseCSVAdSchedule(content.replace(/\t/g, ','));
}

function parseTextAdSchedule(content) {
  const lines = content.trim().split('\n');
  const ads = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (line.startsWith('#') || line.startsWith('//')) continue;
    
    const ad = parseAdLine(line, i + 1);
    if (ad) {
      ads.push(ad);
    }
  }
  
  return ads;
}

function parseAdLine(line, index) {
  const timePatterns = [
    /(\d{1,2}:\d{2}:\d{2}[\.,]\d{3})/,
    /(\d{1,2}:\d{2}:\d{2})/,
    /(\d{1,2}:\d{2})[\s,，]/,
    /(\d+(?:\.\d+)?)\s*(?:秒|s|sec)/,
    /(\d+(?:\.\d+)?)\s*(?:分|m|min)/,
    /^(\d+(?:\.\d+)?)$/
  ];
  
  let startTime = null;
  let endTime = null;
  let duration = null;
  
  const timeMatches = [];
  for (const pattern of timePatterns) {
    const match = line.match(pattern);
    if (match) {
      timeMatches.push(match);
    }
  }
  
  const numbers = [];
  for (const match of timeMatches) {
    let value = match[1];
    if (value.includes(':')) {
      numbers.push(timeToMs(value));
    } else if (match[0].includes('分') || match[0].includes('m')) {
      numbers.push(parseFloat(value) * 60 * 1000);
    } else if (match[0].includes('秒') || match[0].includes('s')) {
      numbers.push(parseFloat(value) * 1000);
    } else {
      numbers.push(parseFloat(value) * 1000);
    }
  }
  
  const uniqueNumbers = [...new Set(numbers)].sort((a, b) => a - b);
  
  if (uniqueNumbers.length >= 2) {
    startTime = uniqueNumbers[0];
    endTime = uniqueNumbers[1];
    duration = endTime - startTime;
  } else if (uniqueNumbers.length === 1) {
    startTime = uniqueNumbers[0];
    const durationMatch = line.match(/(\d+(?:\.\d+)?)\s*(?:秒|s|sec|分钟|min|m)/i);
    if (durationMatch) {
      if (durationMatch[0].includes('分') || durationMatch[0].toLowerCase().includes('m')) {
        duration = parseFloat(durationMatch[1]) * 60 * 1000;
      } else {
        duration = parseFloat(durationMatch[1]) * 1000;
      }
    } else {
      duration = 30000;
    }
    endTime = startTime + duration;
  }
  
  if (startTime === null) {
    return null;
  }
  
  const name = extractAdName(line, index);
  const position = extractPosition(line);
  
  return {
    id: `ad_${index}`,
    order: index,
    name,
    type: ClipType.AD,
    startTime,
    endTime,
    duration: endTime - startTime,
    position,
    source: 'ad_schedule',
    raw: line
  };
}

function extractAdName(line, index) {
  const patterns = [
    /[\"'「]([^\"'」]+)[\"'」]/,
    /(?:广告|ad|spot)[:：\s]+([^\d,，]+)/i,
    /名称[:：\s]+([^\d,，]+)/i,
    /([^:：\d,，\s]+(?:广告|AD|Ad|品牌|冠名))/
  ];
  
  for (const pattern of patterns) {
    const match = line.match(pattern);
    if (match && match[1].trim()) {
      return match[1].trim();
    }
  }
  
  return `广告 ${index}`;
}

function extractPosition(line) {
  const lower = line.toLowerCase();
  
  if (lower.includes('开头') || lower.includes('前置') || lower.includes('pre')) {
    return 'pre';
  }
  if (lower.includes('结尾') || lower.includes('后置') || lower.includes('post')) {
    return 'post';
  }
  if (lower.includes('中场') || lower.includes('中间') || lower.includes('mid')) {
    return 'mid';
  }
  
  return 'unknown';
}

export function serializeAdSchedule(ads) {
  const lines = ['序号,名称,开始时间,结束时间,时长(秒),位置'];
  
  for (const ad of ads) {
    lines.push([
      ad.order,
      ad.name,
      msToReadableTime(ad.startTime),
      msToReadableTime(ad.endTime),
      (ad.duration / 1000).toFixed(2),
      ad.position
    ].join(','));
  }
  
  return lines.join('\n');
}

function msToReadableTime(ms) {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(3);
  
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(6, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(6, '0')}`;
}
