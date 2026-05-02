import { 
  Event, 
  Source, 
  ImportResult, 
  ImportLog, 
  ImportLogEntry,
  EventType
} from './types';
import { createEvent, createSource } from './models';

export interface WebRTCStatsEntry {
  timestamp: number;
  type: string;
  id: string;
  values: Record<string, unknown>;
}

export interface AudioPeakEntry {
  timestamp: number;
  peak: number;
  rms: number;
}

export interface VideoFrameEntry {
  timestamp: number;
  frameNum: number;
  brightness: number;
  isFlash: boolean;
}

export interface ManualAnchorEntry {
  timestamp: number;
  sourceName: string;
  description: string;
}

export function parseJSON<T>(content: string): ImportResult<T> {
  try {
    const data = JSON.parse(content) as T;
    return {
      success: true,
      data,
      errors: [],
      warnings: []
    };
  } catch (error) {
    return {
      success: false,
      errors: [{
        field: 'json',
        message: `JSON解析失败: ${(error as Error).message}`,
        severity: 'error'
      }],
      warnings: []
    };
  }
}

export function parseCSV(content: string): ImportResult<Record<string, string>[]> {
  const lines = content.trim().split('\n');
  if (lines.length < 2) {
    return {
      success: false,
      errors: [{
        field: 'csv',
        message: 'CSV文件至少需要包含表头和一行数据',
        severity: 'error'
      }],
      warnings: []
    };
  }

  const headers = lines[0].split(',').map(h => h.trim());
  const rows: Record<string, string>[] = [];
  const warnings: { field: string; message: string; severity: 'error' | 'warning' }[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    if (values.length !== headers.length) {
      warnings.push({
        field: `row[${i}]`,
        message: `第${i}行列数与表头不一致`,
        severity: 'warning'
      });
      continue;
    }
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx];
    });
    rows.push(row);
  }

  return {
    success: true,
    data: rows,
    errors: [],
    warnings
  };
}

export function parseWebRTCStats(
  content: string, 
  sourceId: string
): ImportResult<{ events: Event[]; importLog: ImportLog }> {
  const jsonResult = parseJSON<WebRTCStatsEntry[]>(content);
  if (!jsonResult.success || !jsonResult.data) {
    return { ...jsonResult, data: undefined };
  }

  const stats = jsonResult.data;
  const events: Event[] = [];
  const logEntries: ImportLogEntry[] = [];

  for (const entry of stats) {
    logEntries.push({
      timestamp: entry.timestamp,
      type: 'webrtc_stats',
      raw: entry
    });

    if (entry.type === 'inbound-rtp' && entry.values.timestamp !== undefined) {
      const rtpTimestamp = entry.values.timestamp as number;
      events.push(createEvent({
        sourceId,
        type: 'rtp_timestamp',
        timestamp: entry.timestamp,
        rtpTimestamp,
        description: `RTP时间戳: ${rtpTimestamp}`,
        confidence: 0.8
      }));
    }
  }

  return {
    success: true,
    data: {
      events,
      importLog: {
        sourceId,
        entries: logEntries
      }
    },
    errors: [],
    warnings: []
  };
}

export function parseAudioPeaks(
  content: string,
  sourceId: string,
  threshold: number = 0.8
): ImportResult<{ events: Event[]; importLog: ImportLog }> {
  const isCSV = content.trim().startsWith('timestamp') || content.includes(',');
  
  let entries: AudioPeakEntry[];
  const warnings: { field: string; message: string; severity: 'error' | 'warning' }[] = [];

  if (isCSV) {
    const csvResult = parseCSV(content);
    if (!csvResult.success || !csvResult.data) {
      return { ...csvResult, data: undefined };
    }
    warnings.push(...csvResult.warnings);
    
    entries = csvResult.data.map(row => ({
      timestamp: parseFloat(row.timestamp || '0'),
      peak: parseFloat(row.peak || '0'),
      rms: parseFloat(row.rms || '0')
    }));
  } else {
    const jsonResult = parseJSON<AudioPeakEntry[]>(content);
    if (!jsonResult.success || !jsonResult.data) {
      return { ...jsonResult, data: undefined };
    }
    entries = jsonResult.data;
  }

  const events: Event[] = [];
  const logEntries: ImportLogEntry[] = [];

  for (const entry of entries) {
    logEntries.push({
      timestamp: entry.timestamp,
      type: 'audio_peak',
      value: entry.peak,
      raw: entry
    });

    if (entry.peak >= threshold) {
      events.push(createEvent({
        sourceId,
        type: 'clap_peak',
        timestamp: entry.timestamp,
        value: entry.peak,
        description: `音频峰值: ${(entry.peak * 100).toFixed(1)}%`,
        confidence: Math.min(1, 0.5 + entry.peak * 0.5)
      }));
    }
  }

  return {
    success: true,
    data: {
      events,
      importLog: {
        sourceId,
        entries: logEntries
      }
    },
    errors: [],
    warnings
  };
}

export function parseVideoFlashes(
  content: string,
  sourceId: string,
  threshold: number = 0.9
): ImportResult<{ events: Event[]; importLog: ImportLog }> {
  const isCSV = content.trim().startsWith('timestamp') || content.includes(',');
  
  let entries: VideoFrameEntry[];
  const warnings: { field: string; message: string; severity: 'error' | 'warning' }[] = [];

  if (isCSV) {
    const csvResult = parseCSV(content);
    if (!csvResult.success || !csvResult.data) {
      return { ...csvResult, data: undefined };
    }
    warnings.push(...csvResult.warnings);
    
    entries = csvResult.data.map(row => ({
      timestamp: parseFloat(row.timestamp || '0'),
      frameNum: parseInt(row.frameNum || '0', 10),
      brightness: parseFloat(row.brightness || '0'),
      isFlash: row.isFlash?.toLowerCase() === 'true' || parseFloat(row.brightness || '0') >= threshold
    }));
  } else {
    const jsonResult = parseJSON<VideoFrameEntry[]>(content);
    if (!jsonResult.success || !jsonResult.data) {
      return { ...jsonResult, data: undefined };
    }
    entries = jsonResult.data;
  }

  const events: Event[] = [];
  const logEntries: ImportLogEntry[] = [];

  for (const entry of entries) {
    logEntries.push({
      timestamp: entry.timestamp,
      type: 'video_frame',
      value: entry.brightness,
      raw: entry
    });

    if (entry.isFlash || entry.brightness >= threshold) {
      events.push(createEvent({
        sourceId,
        type: 'flash_frame',
        timestamp: entry.timestamp,
        value: entry.brightness,
        description: `闪光帧 #${entry.frameNum}, 亮度: ${(entry.brightness * 100).toFixed(1)}%`,
        confidence: Math.min(1, 0.6 + entry.brightness * 0.4)
      }));
    }
  }

  return {
    success: true,
    data: {
      events,
      importLog: {
        sourceId,
        entries: logEntries
      }
    },
    errors: [],
    warnings
  };
}

export function parseManualAnchors(
  content: string,
  sources: Source[]
): ImportResult<{ events: Event[]; importLog: ImportLog[] }> {
  const isCSV = content.trim().startsWith('timestamp') || content.includes(',');
  
  let entries: ManualAnchorEntry[];
  const warnings: { field: string; message: string; severity: 'error' | 'warning' }[] = [];

  if (isCSV) {
    const csvResult = parseCSV(content);
    if (!csvResult.success || !csvResult.data) {
      return { ...csvResult, data: undefined };
    }
    warnings.push(...csvResult.warnings);
    
    entries = csvResult.data.map(row => ({
      timestamp: parseFloat(row.timestamp || '0'),
      sourceName: row.sourceName || '',
      description: row.description || ''
    }));
  } else {
    const jsonResult = parseJSON<ManualAnchorEntry[]>(content);
    if (!jsonResult.success || !jsonResult.data) {
      return { ...jsonResult, data: undefined };
    }
    entries = jsonResult.data;
  }

  const events: Event[] = [];
  const importLogs: ImportLog[] = [];
  const logEntriesBySource: Record<string, ImportLogEntry[]> = {};

  for (const entry of entries) {
    const source = sources.find(s => 
      s.name.toLowerCase() === entry.sourceName.toLowerCase() ||
      s.id === entry.sourceName
    );

    if (!source) {
      warnings.push({
        field: 'sourceName',
        message: `未找到源: ${entry.sourceName}`,
        severity: 'warning'
      });
      continue;
    }

    if (!logEntriesBySource[source.id]) {
      logEntriesBySource[source.id] = [];
    }

    logEntriesBySource[source.id].push({
      timestamp: entry.timestamp,
      type: 'manual_anchor',
      raw: entry
    });

    events.push(createEvent({
      sourceId: source.id,
      type: 'manual_anchor',
      timestamp: entry.timestamp,
      description: entry.description || '人工标记点',
      confidence: 1.0
    }));
  }

  for (const [sourceId, logEntries] of Object.entries(logEntriesBySource)) {
    importLogs.push({ sourceId, entries: logEntries });
  }

  return {
    success: true,
    data: {
      events,
      importLog: importLogs
    },
    errors: [],
    warnings
  };
}
