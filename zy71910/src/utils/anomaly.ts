import { Segment, AnomalyType, SegmentStatus } from '../types';

interface AnomalyResult {
  type: AnomalyType;
  note: string;
  segmentIndex: number;
}

export function detectAnomalies(segments: Array<{ startTime: number; endTime: number; text: string }>): AnomalyResult[] {
  const anomalies: AnomalyResult[] = [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const duration = seg.endTime - seg.startTime;

    if (!seg.text.trim() && duration < 2) {
      anomalies.push({
        type: 'missing',
        note: `第 ${i + 1} 段字幕为空且时长较短`,
        segmentIndex: i
      });
    }

    if (i < segments.length - 1) {
      const nextSeg = segments[i + 1];
      const gap = nextSeg.startTime - seg.endTime;

      if (gap < 0) {
        anomalies.push({
          type: 'overlap',
          note: `第 ${i + 1} 段和第 ${i + 2} 段时间重叠 ${Math.abs(gap).toFixed(2)} 秒`,
          segmentIndex: i
        });
      } else if (gap > 0.5) {
        anomalies.push({
          type: 'drift',
          note: `第 ${i + 1} 段和第 ${i + 2} 段间隔 ${gap.toFixed(2)} 秒，可能漏了内容`,
          segmentIndex: i
        });
      } else if (gap < 0.05) {
        anomalies.push({
          type: 'drift',
          note: `第 ${i + 1} 段和第 ${i + 2} 段只隔了 ${(gap * 1000).toFixed(0)} 毫秒，可能是同一处`,
          segmentIndex: i
        });
      }
    }
  }

  return anomalies;
}

export function detectSilenceFromWaveform(
  channelData: Float32Array,
  sampleRate: number,
  threshold: number = 0.01,
  minSilenceDuration: number = 3
): Array<{ startTime: number; endTime: number }> {
  const silenceRegions: Array<{ startTime: number; endTime: number }> = [];
  const minSilenceSamples = minSilenceDuration * sampleRate;
  let silenceStart = -1;

  for (let i = 0; i < channelData.length; i++) {
    const isSilent = Math.abs(channelData[i]) < threshold;
    
    if (isSilent && silenceStart === -1) {
      silenceStart = i;
    } else if (!isSilent && silenceStart !== -1) {
      const silenceLength = i - silenceStart;
      if (silenceLength >= minSilenceSamples) {
        silenceRegions.push({
          startTime: silenceStart / sampleRate,
          endTime: i / sampleRate
        });
      }
      silenceStart = -1;
    }
  }

  if (silenceStart !== -1) {
    const silenceLength = channelData.length - silenceStart;
    if (silenceLength >= minSilenceSamples) {
      silenceRegions.push({
        startTime: silenceStart / sampleRate,
        endTime: channelData.length / sampleRate
      });
    }
  }

  return silenceRegions;
}

export function applyAnomalyMarks<T extends { anomalyType: AnomalyType; anomalyNote?: string; status: SegmentStatus }>(
  segments: T[],
  anomalies: AnomalyResult[]
): T[] {
  return segments.map((seg, idx) => {
    const anomaly = anomalies.find(a => a.segmentIndex === idx);
    if (anomaly) {
      return {
        ...seg,
        anomalyType: anomaly.type,
        anomalyNote: anomaly.note,
        status: 'pending' as SegmentStatus
      };
    }
    return seg;
  });
}
