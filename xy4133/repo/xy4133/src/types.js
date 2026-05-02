export const ClipType = {
  SEGMENT: 'segment',
  SILENCE: 'silence',
  AD: 'ad',
  CHAPTER: 'chapter'
};

export const IssueType = {
  OVERLAP: 'overlap',
  GAP: 'gap',
  SILENCE_NOT_CUT: 'silence_not_cut',
  LOUDNESS_PEAK: 'loudness_peak',
  AD_OVERLAPS_CONTENT: 'ad_overlaps_content',
  SUBTITLE_DRIFT: 'subtitle_drift',
  OUT_OF_ORDER: 'out_of_order'
};

export const Severity = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low'
};

export function timeToMs(timeStr) {
  if (typeof timeStr === 'number') return timeStr;
  
  const normalized = timeStr.replace(',', '.');
  const parts = normalized.split(':');
  let ms = 0;
  
  if (parts.length === 3) {
    ms += parseFloat(parts[0]) * 3600000;
    ms += parseFloat(parts[1]) * 60000;
    ms += parseFloat(parts[2]) * 1000;
  } else if (parts.length === 2) {
    ms += parseFloat(parts[0]) * 60000;
    ms += parseFloat(parts[1]) * 1000;
  } else {
    ms += parseFloat(parts[0]) * 1000;
  }
  
  return ms;
}

export function msToTime(ms) {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = Math.floor(ms % 1000);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`;
}

export function msToReadable(ms) {
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(2)}s`;
  }
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
