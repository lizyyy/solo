import { Source, Event, Session, SESSION_VERSION } from './types';
import { createSource, createEvent, createSession, resetColorIndex } from './models';
import { v4 as uuidv4 } from 'uuid';

export interface SampleScenario {
  name: string;
  description: string;
  sources: Source[];
  events: Event[];
  expectedDelays: Record<string, number>;
}

function addJitter(value: number, jitterMs: number = 5): number {
  return value + (Math.random() - 0.5) * jitterMs;
}

export function generateSimpleBandScenario(): SampleScenario {
  resetColorIndex();
  
  const drumSource = createSource({
    id: uuidv4(),
    name: '鼓手麦克风',
    type: 'microphone',
    sampleRate: 48000,
    color: '#e94560'
  });

  const vocalSource = createSource({
    id: uuidv4(),
    name: '主唱麦克风',
    type: 'microphone',
    sampleRate: 48000,
    color: '#3498db'
  });

  const cameraSource = createSource({
    id: uuidv4(),
    name: '主唱摄像头',
    type: 'camera',
    frameRate: 30,
    color: '#27ae60'
  });

  const remoteSource = createSource({
    id: uuidv4(),
    name: '远程贝斯手',
    type: 'remote_stream',
    sampleRate: 44100,
    color: '#9b59b6'
  });

  const backingTrackSource = createSource({
    id: uuidv4(),
    name: '伴奏轨',
    type: 'local_file',
    sampleRate: 48000,
    color: '#f39c12'
  });

  const sources = [drumSource, vocalSource, cameraSource, remoteSource, backingTrackSource];

  const baseTime = 0;
  const clapIntervals = [1000, 3000, 5000, 7000, 9000, 11000, 13000];
  
  const events: Event[] = [];

  const expectedDelays: Record<string, number> = {
    [drumSource.id]: 0,
    [vocalSource.id]: 45,
    [cameraSource.id]: 120,
    [remoteSource.id]: 250,
    [backingTrackSource.id]: -30
  };

  for (const interval of clapIntervals) {
    const referenceTime = baseTime + interval;

    events.push(createEvent({
      sourceId: drumSource.id,
      type: 'clap_peak',
      timestamp: addJitter(referenceTime + expectedDelays[drumSource.id], 3),
      value: 0.95 + Math.random() * 0.05,
      description: `鼓点击峰值 #${clapIntervals.indexOf(interval) + 1}`,
      confidence: 0.95
    }));

    events.push(createEvent({
      sourceId: vocalSource.id,
      type: 'clap_peak',
      timestamp: addJitter(referenceTime + expectedDelays[vocalSource.id], 4),
      value: 0.88 + Math.random() * 0.1,
      description: `人声峰值 #${clapIntervals.indexOf(interval) + 1}`,
      confidence: 0.9
    }));

    events.push(createEvent({
      sourceId: cameraSource.id,
      type: 'flash_frame',
      timestamp: addJitter(referenceTime + expectedDelays[cameraSource.id], 8),
      value: 0.92 + Math.random() * 0.08,
      description: `视频闪光帧 #${clapIntervals.indexOf(interval) + 1}`,
      confidence: 0.85
    }));

    events.push(createEvent({
      sourceId: remoteSource.id,
      type: 'rtp_timestamp',
      timestamp: addJitter(referenceTime + expectedDelays[remoteSource.id], 15),
      rtpTimestamp: referenceTime * 90,
      description: `RTP时间戳 #${clapIntervals.indexOf(interval) + 1}`,
      confidence: 0.75
    }));

    events.push(createEvent({
      sourceId: backingTrackSource.id,
      type: 'manual_anchor',
      timestamp: addJitter(referenceTime + expectedDelays[backingTrackSource.id], 2),
      description: `伴奏轨锚点 #${clapIntervals.indexOf(interval) + 1}`,
      confidence: 1.0
    }));
  }

  events.push(createEvent({
    sourceId: drumSource.id,
    type: 'manual_anchor',
    timestamp: 4000,
    description: '人工标记：开场鼓点',
    confidence: 1.0
  }));

  return {
    name: '乐队排练场景',
    description: '模拟一个包含鼓手、主唱、摄像头、远程贝斯手和伴奏轨的乐队排练场景。每个源都有不同的延迟偏移。',
    sources,
    events,
    expectedDelays
  };
}

export function generateJitterScenario(): SampleScenario {
  resetColorIndex();
  
  const stableSource = createSource({
    id: uuidv4(),
    name: '稳定源 (本地麦克风)',
    type: 'microphone',
    sampleRate: 48000,
    color: '#27ae60'
  });

  const jitterSource = createSource({
    id: uuidv4(),
    name: '抖动源 (远程WebRTC)',
    type: 'remote_stream',
    sampleRate: 48000,
    color: '#e94560'
  });

  const sources = [stableSource, jitterSource];
  const events: Event[] = [];

  const baseTime = 0;
  for (let i = 0; i < 20; i++) {
    const referenceTime = baseTime + i * 500;

    events.push(createEvent({
      sourceId: stableSource.id,
      type: 'clap_peak',
      timestamp: referenceTime,
      value: 0.9,
      description: `稳定峰值 #${i + 1}`,
      confidence: 0.95
    }));

    const jitterAmount = i < 10 ? 20 : 80;
    events.push(createEvent({
      sourceId: jitterSource.id,
      type: 'rtp_timestamp',
      timestamp: referenceTime + (Math.random() - 0.5) * jitterAmount,
      rtpTimestamp: referenceTime * 90,
      description: `RTP时间戳 #${i + 1}`,
      confidence: 0.7
    }));
  }

  return {
    name: '网络抖动场景',
    description: '模拟一个稳定源和一个有网络抖动的远程源。可以观察到抖动过大导致的校准问题。',
    sources,
    events,
    expectedDelays: {
      [stableSource.id]: 0,
      [jitterSource.id]: 0
    }
  };
}

export function generateClockDriftScenario(): SampleScenario {
  resetColorIndex();
  
  const referenceSource = createSource({
    id: uuidv4(),
    name: '参考源 (48kHz)',
    type: 'local_file',
    sampleRate: 48000,
    color: '#3498db'
  });

  const fastSource = createSource({
    id: uuidv4(),
    name: '快时钟源 (48001Hz)',
    type: 'remote_stream',
    sampleRate: 48000,
    color: '#e94560'
  });

  const slowSource = createSource({
    id: uuidv4(),
    name: '慢时钟源 (47999Hz)',
    type: 'camera',
    frameRate: 30,
    color: '#f39c12'
  });

  const sources = [referenceSource, fastSource, slowSource];
  const events: Event[] = [];

  const driftRateFast = 100;
  const driftRateSlow = -100;

  for (let i = 0; i < 15; i++) {
    const referenceTime = i * 1000;

    events.push(createEvent({
      sourceId: referenceSource.id,
      type: 'manual_anchor',
      timestamp: referenceTime,
      description: `参考锚点 #${i + 1}`,
      confidence: 1.0
    }));

    const driftAmountFast = (referenceTime / 1000) * driftRateFast;
    events.push(createEvent({
      sourceId: fastSource.id,
      type: 'clap_peak',
      timestamp: referenceTime + driftAmountFast + (Math.random() - 0.5) * 5,
      value: 0.85,
      description: `快源峰值 #${i + 1}`,
      confidence: 0.85
    }));

    const driftAmountSlow = (referenceTime / 1000) * driftRateSlow;
    events.push(createEvent({
      sourceId: slowSource.id,
      type: 'flash_frame',
      timestamp: referenceTime + driftAmountSlow + (Math.random() - 0.5) * 5,
      value: 0.9,
      description: `慢源闪光帧 #${i + 1}`,
      confidence: 0.8
    }));
  }

  return {
    name: '时钟漂移场景',
    description: '模拟三个源，其中两个有不同方向的时钟漂移。可以观察到时间越长偏差越大的情况。',
    sources,
    events,
    expectedDelays: {
      [referenceSource.id]: 0,
      [fastSource.id]: 0,
      [slowSource.id]: 0
    }
  };
}

export function generateSampleSession(scenario: SampleScenario = generateSimpleBandScenario()): Session {
  return createSession({
    name: scenario.name,
    description: scenario.description,
    timestampUnit: 'ms',
    sources: scenario.sources,
    events: scenario.events,
    calibrationResults: [],
    problems: [],
    syncIssues: [],
    importLogs: []
  });
}

export function generateSampleWebRTCStatsJSON(sourceId: string): string {
  const stats = [];
  
  for (let i = 0; i < 10; i++) {
    stats.push({
      timestamp: i * 1000,
      type: 'inbound-rtp',
      id: `rtp_${i}`,
      values: {
        timestamp: i * 90000,
        packetsReceived: 100 + i * 10,
        packetsLost: 0,
        jitter: 0.01 + Math.random() * 0.02
      }
    });
  }

  return JSON.stringify(stats, null, 2);
}

export function generateSampleAudioPeaksCSV(): string {
  const lines = ['timestamp,peak,rms'];
  
  for (let i = 0; i < 20; i++) {
    const time = i * 500;
    const isPeak = i % 3 === 0;
    const peak = isPeak ? 0.8 + Math.random() * 0.2 : 0.1 + Math.random() * 0.2;
    const rms = peak * 0.7;
    
    lines.push(`${time},${peak.toFixed(4)},${rms.toFixed(4)}`);
  }

  return lines.join('\n');
}

export function generateSampleVideoFlashesJSON(): string {
  const frames = [];
  
  for (let i = 0; i < 30; i++) {
    const time = i * (1000 / 30);
    const isFlash = i % 10 === 0;
    const brightness = isFlash ? 0.95 : 0.2 + Math.random() * 0.1;
    
    frames.push({
      timestamp: time,
      frameNum: i,
      brightness,
      isFlash
    });
  }

  return JSON.stringify(frames, null, 2);
}

export function generateSampleManualAnchorsCSV(): string {
  const lines = ['timestamp,sourceName,description'];
  
  lines.push('1000,鼓手麦克风,开场鼓点');
  lines.push('3000,主唱麦克风,第一声主唱');
  lines.push('5000,伴奏轨,副歌开始');
  lines.push('7000,主唱摄像头,镜头切换');
  lines.push('9000,鼓手麦克风,独奏开始');

  return lines.join('\n');
}

export const sampleScenarios = [
  generateSimpleBandScenario,
  generateJitterScenario,
  generateClockDriftScenario
];
