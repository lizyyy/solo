import { ParsedFrame, DeviceProfile, Issue } from '../types';

interface FrameParseResult {
  frame: ParsedFrame | null;
  issue: Issue | null;
}

export function parseSerialLog(
  logContent: string,
  deviceProfiles: DeviceProfile[]
): { frames: ParsedFrame[]; issues: Issue[] } {
  const lines = logContent.split(/\r?\n/);
  const frames: ParsedFrame[] = [];
  const issues: Issue[] = [];
  const frameHashes = new Map<string, number>();
  const stationToProfile = new Map(deviceProfiles.map(p => [p.stationId, p]));

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex].trim();
    if (!line) continue;

    try {
      const result = parseLogLine(line, stationToProfile, lineIndex);
      
      if (result.frame) {
        const hash = frameHash(result.frame);
        const prevIndex = frameHashes.get(hash);
        
        if (prevIndex !== undefined) {
          result.frame.isDuplicate = true;
          issues.push(createDuplicateIssue(result.frame, prevIndex));
        } else {
          frameHashes.set(hash, lineIndex);
        }
        
        frames.push(result.frame);
      }
      
      if (result.issue) {
        issues.push(result.issue);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown parse error';
      issues.push(createBadFrameIssue(line, lineIndex, message));
    }
  }

  return { frames, issues };
}

function parseLogLine(
  line: string,
  stationToProfile: Map<string, DeviceProfile>,
  lineIndex: number
): FrameParseResult {
  const match = line.match(/^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}(?:\.\d+)?)\s+\[(\w+)\]\s+(.+)$/);
  
  if (!match) {
    return {
      frame: null,
      issue: createBadFrameIssue(line, lineIndex, 'Invalid log line format. Expected: timestamp [stationId] data'),
    };
  }

  const [, timestampStr, stationId, dataStr] = match;
  const profile = stationToProfile.get(stationId);

  if (!profile) {
    return {
      frame: null,
      issue: {
        id: `issue_${Date.now()}_${lineIndex}`,
        type: 'missing_data',
        severity: 'medium',
        timestamp: parseTimestamp(timestampStr),
        stationId,
        description: `No device profile found for station: ${stationId}`,
        details: { lineIndex, rawLine: line },
      },
    };
  }

  const frameData = extractFrameData(dataStr, profile, lineIndex);
  
  if (!frameData.valid) {
    return {
      frame: null,
      issue: createBadFrameIssue(line, lineIndex, frameData.error || 'Unknown frame error'),
    };
  }

  const parsedFrame: ParsedFrame = {
    raw: line,
    stationId,
    timestamp: parseTimestamp(timestampStr),
    weight: frameData.weight,
    unit: profile.unit,
    status: frameData.status,
    frameType: profile.frameFormat,
    isDuplicate: false,
  };

  return { frame: parsedFrame, issue: null };
}

interface FrameData {
  valid: boolean;
  weight: number;
  status: 'stable' | 'unstable' | 'error';
  error?: string;
}

function extractFrameData(
  dataStr: string,
  profile: DeviceProfile,
  _lineIndex: number
): FrameData {
  const stx = unescapeControlChars(profile.stx);
  const etx = unescapeControlChars(profile.etx);

  const stxIndex = dataStr.indexOf(stx);
  const etxIndex = dataStr.lastIndexOf(etx);

  if (stxIndex === -1) {
    return { valid: false, weight: 0, status: 'error', error: `STX (${profile.stx}) not found in frame` };
  }

  if (etxIndex === -1) {
    return { valid: false, weight: 0, status: 'error', error: `ETX (${profile.etx}) not found in frame` };
  }

  if (etxIndex <= stxIndex) {
    return { valid: false, weight: 0, status: 'error', error: 'ETX appears before STX' };
  }

  const frameContent = dataStr.slice(stxIndex + stx.length, etxIndex);

  return parseFrameContent(frameContent, profile);
}

function parseFrameContent(frameContent: string, profile: DeviceProfile): FrameData {
  switch (profile.frameFormat) {
    case 'type1':
      return parseType1Frame(frameContent, profile);
    case 'type2':
      return parseType2Frame(frameContent, profile);
    case 'type3':
      return parseType3Frame(frameContent, profile);
    default:
      return { valid: false, weight: 0, status: 'error', error: `Unknown frame format: ${profile.frameFormat}` };
  }
}

function parseType1Frame(frameContent: string, profile: DeviceProfile): FrameData {
  const trimmed = frameContent.trim();
  const stableMatch = trimmed.match(/^(S|U)([+-]?\d+\.?\d*)$/);
  
  if (stableMatch) {
    const [, statusChar, weightStr] = stableMatch;
    const weight = parseFloat(weightStr);
    
    if (isNaN(weight)) {
      return { valid: false, weight: 0, status: 'error', error: `Invalid weight value: ${weightStr}` };
    }

    return {
      valid: true,
      weight: roundWeight(weight, profile.precision),
      status: statusChar === 'S' ? 'stable' : 'unstable',
    };
  }

  const simpleMatch = trimmed.match(/^[+-]?\d+\.?\d*$/);
  if (simpleMatch) {
    const weight = parseFloat(trimmed);
    if (!isNaN(weight)) {
      return {
        valid: true,
        weight: roundWeight(weight, profile.precision),
        status: 'stable',
      };
    }
  }

  return { valid: false, weight: 0, status: 'error', error: `Invalid Type1 frame format: ${trimmed}` };
}

function parseType2Frame(frameContent: string, profile: DeviceProfile): FrameData {
  const parts = frameContent.split(/[,;\s]+/);
  
  if (parts.length < 2) {
    return { valid: false, weight: 0, status: 'error', error: `Type2 frame requires at least 2 fields: ${frameContent}` };
  }

  const weightStr = parts[0];
  const statusStr = parts[1] || 'S';
  
  const weight = parseFloat(weightStr);
  
  if (isNaN(weight)) {
    return { valid: false, weight: 0, status: 'error', error: `Invalid weight value: ${weightStr}` };
  }

  const status = statusStr.toUpperCase().includes('UNSTABLE') || statusStr.toUpperCase() === 'U' 
    ? 'unstable' 
    : 'stable';

  return {
    valid: true,
    weight: roundWeight(weight, profile.precision),
    status,
  };
}

function parseType3Frame(frameContent: string, profile: DeviceProfile): FrameData {
  const jsonMatch = frameContent.match(/\{.*\}/);
  if (jsonMatch) {
    try {
      const json = JSON.parse(jsonMatch[0]);
      const weight = json.weight ?? json.w ?? json.value;
      
      if (weight === undefined) {
        return { valid: false, weight: 0, status: 'error', error: 'Type3 JSON frame missing weight field' };
      }

      const status = json.status === 'unstable' ? 'unstable' : 'stable';
      
      return {
        valid: true,
        weight: roundWeight(parseFloat(String(weight)), profile.precision),
        status,
      };
    } catch {
      // Fall through to regex parsing
    }
  }

  const weightMatch = frameContent.match(/W:?\s*([+-]?\d+\.?\d*)/i);
  const statusMatch = frameContent.match(/S(?:tatus)?:?\s*(S|U|stable|unstable)/i);
  
  if (weightMatch) {
    const weight = parseFloat(weightMatch[1]);
    const status = statusMatch 
      ? (statusMatch[1].toUpperCase() === 'U' || statusMatch[1].toLowerCase() === 'unstable' ? 'unstable' : 'stable')
      : 'stable';
    
    if (!isNaN(weight)) {
      return {
        valid: true,
        weight: roundWeight(weight, profile.precision),
        status,
      };
    }
  }

  return { valid: false, weight: 0, status: 'error', error: `Invalid Type3 frame format: ${frameContent}` };
}

function unescapeControlChars(str: string): string {
  return str
    .replace(/\\x([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\\\/g, '\\');
}

function roundWeight(weight: number, precision: number): number {
  const factor = Math.pow(10, precision);
  return Math.round(weight * factor) / factor;
}

function parseTimestamp(timestampStr: string): Date {
  const date = new Date(timestampStr);
  if (isNaN(date.getTime())) {
    return new Date();
  }
  return date;
}

function frameHash(frame: ParsedFrame): string {
  return `${frame.stationId}_${frame.timestamp.getTime()}_${frame.weight}_${frame.status}`;
}

function createBadFrameIssue(rawLine: string, lineIndex: number, error: string): Issue {
  return {
    id: `issue_bad_frame_${Date.now()}_${lineIndex}`,
    type: 'bad_frame',
    severity: 'medium',
    timestamp: new Date(),
    stationId: 'unknown',
    description: `Bad frame at line ${lineIndex + 1}`,
    details: {
      lineIndex,
      rawLine: rawLine.substring(0, 200),
      error,
    },
  };
}

function createDuplicateIssue(frame: ParsedFrame, prevLineIndex: number): Issue {
  return {
    id: `issue_dup_${Date.now()}_${frame.timestamp.getTime()}`,
    type: 'duplicate_frame',
    severity: 'low',
    timestamp: frame.timestamp,
    stationId: frame.stationId,
    description: `Duplicate frame detected for station ${frame.stationId}`,
    details: {
      weight: frame.weight,
      status: frame.status,
      previousLineIndex: prevLineIndex,
    },
    relatedFrame: frame,
  };
}
