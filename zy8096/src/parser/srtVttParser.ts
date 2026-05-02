import { SubtitleCue, ParsedSubtitle } from './types';

export function parseTimeToMs(timeStr: string): number {
  const parts = timeStr.trim().split(/[:.,]/);
  if (parts.length < 3) return 0;

  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  const secondsAndMs = parts[2].split(' ');
  const seconds = parseInt(secondsAndMs[0], 10);
  const ms = secondsAndMs[1] ? parseInt(secondsAndMs[1].padEnd(3, '0').slice(0, 3), 10) : 0;

  return hours * 3600000 + minutes * 60000 + seconds * 1000 + ms;
}

export function msToSrtTime(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = Math.round(ms % 1000);

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`;
}

export function msToVttTime(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = ms % 1000;

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
}

function parseSrtCue(cueBlock: string, index: number): SubtitleCue | null {
  const lines = cueBlock.trim().split('\n');
  if (lines.length < 3) return null;

  const timeLine = lines[1];
  const timeMatch = timeLine.match(/(\d{2}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]\d{3})/);
  if (!timeMatch) return null;

  return {
    index,
    startTime: parseTimeToMs(timeMatch[1]),
    endTime: parseTimeToMs(timeMatch[2]),
    text: lines.slice(2).join('\n').trim()
  };
}

function parseVttCue(cueBlock: string, index: number): SubtitleCue | null {
  const lines = cueBlock.trim().split('\n');
  if (lines.length < 3) return null;

  const timeLine = lines[1];
  const timeMatch = timeLine.match(/(\d{2}:\d{2}:\d{2}[.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[.]\d{3})/);
  if (!timeMatch) {
    const shortMatch = timeLine.match(/(\d{2}:\d{2}[.]\d{3})\s*-->\s*(\d{2}:\d{2}[.]\d{3})/);
    if (!shortMatch) return null;
    return {
      index,
      startTime: parseTimeToMs('00:' + shortMatch[1]),
      endTime: parseTimeToMs('00:' + shortMatch[2]),
      text: lines.slice(2).join('\n').trim()
    };
  }

  return {
    index,
    startTime: parseTimeToMs(timeMatch[1]),
    endTime: parseTimeToMs(timeMatch[2]),
    text: lines.slice(2).join('\n').trim()
  };
}

export function parseSrt(content: string): ParsedSubtitle {
  const cueBlocks = content.split(/\n\s*\n/).filter(block => block.trim());
  const cues: SubtitleCue[] = [];
  let maxEndTime = 0;

  cueBlocks.forEach((block, i) => {
    const cue = parseSrtCue(block, i + 1);
    if (cue) {
      cues.push(cue);
      maxEndTime = Math.max(maxEndTime, cue.endTime);
    }
  });

  return {
    format: 'srt',
    cues,
    duration: maxEndTime
  };
}

export function parseVtt(content: string): ParsedSubtitle {
  const lines = content.split('\n');
  let metadataEndIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '') {
      metadataEndIndex = i;
      break;
    }
  }

  const cueContent = lines.slice(metadataEndIndex).join('\n');
  const cueBlocks = cueContent.split(/\n\s*\n/).filter(block => block.trim());
  const cues: SubtitleCue[] = [];
  let maxEndTime = 0;

  cueBlocks.forEach((block, i) => {
    const cue = parseVttCue(block, i + 1);
    if (cue) {
      cues.push(cue);
      maxEndTime = Math.max(maxEndTime, cue.endTime);
    }
  });

  return {
    format: 'vtt',
    cues,
    duration: maxEndTime
  };
}

export function parseSubtitle(content: string): ParsedSubtitle {
  const trimmed = content.trim();
  if (trimmed.startsWith('WEBVTT')) {
    return parseVtt(trimmed);
  }
  return parseSrt(trimmed);
}

export function writeSrt(cues: SubtitleCue[]): string {
  return cues.map((cue, i) => {
    const startTime = msToSrtTime(cue.startTime);
    const endTime = msToSrtTime(cue.endTime);
    return `${i + 1}\n${startTime} --> ${endTime}\n${cue.text}`;
  }).join('\n\n');
}

export function writeVtt(cues: SubtitleCue[]): string {
  const header = 'WEBVTT\n\n';
  const body = cues.map((cue, i) => {
    const startTime = msToVttTime(cue.startTime);
    const endTime = msToVttTime(cue.endTime);
    return `${i + 1}\n${startTime} --> ${endTime}\n${cue.text}`;
  }).join('\n\n');

  return header + body;
}
