const RISK_LEVELS = {
  CRITICAL: { name: 'CRITICAL', weight: 100, color: 'red' },
  HIGH: { name: 'HIGH', weight: 75, color: 'redBright' },
  MEDIUM: { name: 'MEDIUM', weight: 50, color: 'yellow' },
  LOW: { name: 'LOW', weight: 25, color: 'blue' },
  INFO: { name: 'INFO', weight: 10, color: 'gray' }
};

const RISK_TYPES = {
  VFR: 'variable_frame_rate',
  NO_AUDIO: 'no_audio_track',
  MULTI_AUDIO: 'multiple_audio_tracks',
  SUBTITLE_CONFLICT: 'subtitle_conflict',
  NO_VIDEO: 'no_video_track',
  UNKNOWN_CODEC: 'unknown_codec',
  EXTREME_RESOLUTION: 'extreme_resolution',
  ZERO_DURATION: 'zero_duration',
  CORRUPTED: 'probe_failed',
  HIGH_BITRATE: 'source_high_bitrate',
  LOW_BITRATE: 'source_low_bitrate'
};

const FAILURE_SAMPLES = [
  {
    id: 'vfr_transcode_failure',
    description: 'VFR 视频转码后音画不同步',
    riskTypes: [RISK_TYPES.VFR],
    failureRate: 0.35,
    typicalIssues: ['音画不同步', '帧率异常', '播放卡顿']
  },
  {
    id: 'no_audio_silence',
    description: '无声源文件被忽略',
    riskTypes: [RISK_TYPES.NO_AUDIO],
    failureRate: 0.15,
    typicalIssues: ['输出无音频', '转码失败']
  },
  {
    id: 'subtitle_codec_error',
    description: '字幕流编码不兼容',
    riskTypes: [RISK_TYPES.SUBTITLE_CONFLICT],
    failureRate: 0.25,
    typicalIssues: ['字幕丢失', '乱码', '转码报错']
  },
  {
    id: 'multi_audio_mapping',
    description: '多音轨选择错误',
    riskTypes: [RISK_TYPES.MULTI_AUDIO],
    failureRate: 0.20,
    typicalIssues: ['音轨错误', '语言不对', '无声']
  },
  {
    id: 'corrupted_input',
    description: '源文件损坏无法读取',
    riskTypes: [RISK_TYPES.CORRUPTED],
    failureRate: 1.0,
    typicalIssues: ['转码失败', '输出损坏']
  }
];

function detectVFRRisk(mediaInfo) {
  const risks = [];
  const analysis = mediaInfo.frameRateAnalysis;
  
  if (!analysis || !analysis.isVFR) {
    return risks;
  }

  const avgFrameRate = analysis.avgFrameRate || 0;
  const minFrameRate = analysis.minFrameRate || 0;
  const maxFrameRate = analysis.maxFrameRate || 0;
  const variance = analysis.frameRateVariance || 0;
  
  const cv = avgFrameRate > 0 
    ? Math.sqrt(variance) / avgFrameRate 
    : 0;

  let level = RISK_LEVELS.LOW;
  let details = [];

  if (cv > 0.2) {
    level = RISK_LEVELS.HIGH;
    details.push('帧率波动剧烈');
  } else if (cv > 0.1) {
    level = RISK_LEVELS.MEDIUM;
    details.push('帧率有明显波动');
  }

  if (maxFrameRate > 60) {
    level = cv > 0.1 ? RISK_LEVELS.HIGH : RISK_LEVELS.MEDIUM;
    details.push(`最高帧率 ${maxFrameRate.toFixed(1)}fps 可能超出编码支持`);
  }

  risks.push({
    type: RISK_TYPES.VFR,
    level,
    title: '可变帧率 (VFR)',
    message: '检测到可变帧率视频，转码后可能出现音画不同步',
    details: [
      `平均帧率: ${avgFrameRate.toFixed(2)}fps`,
      `帧率范围: ${minFrameRate.toFixed(1)} - ${maxFrameRate.toFixed(1)}fps`,
      `变异系数: ${(cv * 100).toFixed(1)}%`,
      ...details
    ],
    recommendation: '建议添加 -fpsmax 或 -r 参数强制固定帧率输出',
    relatedSamples: FAILURE_SAMPLES.filter(s => s.riskTypes.includes(RISK_TYPES.VFR))
  });

  return risks;
}

function detectAudioRisks(mediaInfo) {
  const risks = [];
  const audioTracks = mediaInfo.audio || [];
  const audioTrackCount = mediaInfo.audioTrackCount || 0;

  if (!mediaInfo.hasAudio || audioTrackCount === 0) {
    risks.push({
      type: RISK_TYPES.NO_AUDIO,
      level: RISK_LEVELS.MEDIUM,
      title: '缺失音轨',
      message: '视频文件不包含音频流',
      details: [
        '音频轨道数: 0'
      ],
      recommendation: '检查源文件是否正确，或添加 -an 参数明确禁用音频',
      relatedSamples: FAILURE_SAMPLES.filter(s => s.riskTypes.includes(RISK_TYPES.NO_AUDIO))
    });
  }

  if (audioTrackCount > 1) {
    const languages = audioTracks.map(a => `${a.language || 'und'} (${a.codec || 'unknown'})`).join(', ');
    risks.push({
      type: RISK_TYPES.MULTI_AUDIO,
      level: RISK_LEVELS.LOW,
      title: '多音轨文件',
      message: `检测到 ${audioTrackCount} 条音轨，可能需要手动选择`,
      details: [
        `音频轨道数: ${audioTrackCount}`,
        `音轨信息: ${languages}`
      ],
      recommendation: '使用 -map 0:a:<index> 指定要使用的音轨',
      relatedSamples: FAILURE_SAMPLES.filter(s => s.riskTypes.includes(RISK_TYPES.MULTI_AUDIO))
    });

    const hasDefault = audioTracks.some(a => a.isDefault);
    if (!hasDefault && audioTrackCount > 1) {
      risks[risks.length - 1].level = RISK_LEVELS.MEDIUM;
      risks[risks.length - 1].details.push('警告: 没有标记为默认的音轨');
    }
  }

  return risks;
}

function detectSubtitleRisks(mediaInfo) {
  const risks = [];
  const subtitles = mediaInfo.subtitles || [];

  if (subtitles.length === 0) return risks;

  const subtitleCodecs = new Set(subtitles.map(s => s.codec));
  const problematicCodecs = ['hdmv_pgs_subtitle', 'dvd_subtitle', 'xsub'];
  const hasImageSubs = subtitles.some(s => problematicCodecs.includes(s.codec));

  if (hasImageSubs) {
    risks.push({
      type: RISK_TYPES.SUBTITLE_CONFLICT,
      level: RISK_LEVELS.HIGH,
      title: '图像字幕不兼容',
      message: '检测到图像格式字幕，MP4 容器不支持直接嵌入',
      details: [
        `字幕轨道数: ${subtitles.length}`,
        `字幕编码: ${Array.from(subtitleCodecs).join(', ')}`
      ],
      recommendation: '使用 MKV 输出容器，或提前烧录字幕到视频',
      relatedSamples: FAILURE_SAMPLES.filter(s => s.riskTypes.includes(RISK_TYPES.SUBTITLE_CONFLICT))
    });
  }

  const duplicateLangs = {};
  subtitles.forEach(s => {
    duplicateLangs[s.language] = (duplicateLangs[s.language] || 0) + 1;
  });
  
  const duplicates = Object.entries(duplicateLangs).filter(([_, count]) => count > 1);
  if (duplicates.length > 0) {
    risks.push({
      type: RISK_TYPES.SUBTITLE_CONFLICT,
      level: RISK_LEVELS.MEDIUM,
      title: '同语言多字幕',
      message: `检测到 ${duplicates.length} 组同语言字幕，可能混淆`,
      details: duplicates.map(([lang, count]) => `${lang}: ${count} 条`),
      recommendation: '明确指定要保留的字幕轨道索引',
      relatedSamples: []
    });
  }

  return risks;
}

function detectVideoRisks(mediaInfo) {
  const risks = [];
  const video = mediaInfo.video || [];

  if (video.length === 0) {
    risks.push({
      type: RISK_TYPES.NO_VIDEO,
      level: RISK_LEVELS.CRITICAL,
      title: '缺失视频轨',
      message: '文件不包含视频流',
      details: ['视频轨道数: 0'],
      recommendation: '检查源文件完整性',
      relatedSamples: []
    });
    return risks;
  }

  const mainVideo = video[0];

  if (mainVideo.codec === 'unknown' || !mainVideo.codec) {
    risks.push({
      type: RISK_TYPES.UNKNOWN_CODEC,
      level: RISK_LEVELS.HIGH,
      title: '未知视频编码',
      message: '无法识别视频编码格式',
      details: [`编码: ${mainVideo.codec || 'unknown'}`],
      recommendation: '尝试更新 FFmpeg 或使用其他工具转码',
      relatedSamples: []
    });
  }

  if (mainVideo.height > 4320 || mainVideo.width > 7680) {
    risks.push({
      type: RISK_TYPES.EXTREME_RESOLUTION,
      level: RISK_LEVELS.HIGH,
      title: '超高分辨率',
      message: `分辨率 ${mainVideo.resolution} 超出常规处理范围`,
      details: [`分辨率: ${mainVideo.resolution}`],
      recommendation: '考虑降低目标分辨率或使用硬件加速',
      relatedSamples: []
    });
  }

  const duration = mediaInfo.format?.duration || 0;
  if (duration <= 0) {
    risks.push({
      type: RISK_TYPES.ZERO_DURATION,
      level: RISK_LEVELS.CRITICAL,
      title: '时长为零',
      message: '文件时长为零，可能损坏或不完整',
      details: [`报告时长: ${duration}秒`],
      recommendation: '检查源文件是否完整下载',
      relatedSamples: FAILURE_SAMPLES.filter(s => s.riskTypes.includes(RISK_TYPES.CORRUPTED))
    });
  }

  const bitrate = mainVideo.bitRate || mediaInfo.format?.bitRate || 0;
  if (bitrate > 100000000) {
    risks.push({
      type: RISK_TYPES.HIGH_BITRATE,
      level: RISK_LEVELS.MEDIUM,
      title: '源文件码率过高',
      message: `源码率 ${(bitrate / 1000000).toFixed(1)}Mbps 可能导致转码缓慢`,
      details: [`源码率: ${(bitrate / 1000000).toFixed(2)} Mbps`],
      recommendation: '考虑使用硬件加速或分段处理',
      relatedSamples: []
    });
  }

  return risks;
}

function detectProbeFailure(mediaInfo) {
  if (mediaInfo.success === false || mediaInfo.error) {
    return [{
      type: RISK_TYPES.CORRUPTED,
      level: RISK_LEVELS.CRITICAL,
      title: '探测失败',
      message: '无法解析媒体文件',
      details: [mediaInfo.error || '未知错误'],
      recommendation: '检查文件是否存在且为有效媒体文件',
      relatedSamples: FAILURE_SAMPLES.filter(s => s.riskTypes.includes(RISK_TYPES.CORRUPTED))
    }];
  }
  return [];
}

function detectAllRisks(mediaInfo) {
  const risks = [];

  risks.push(...detectProbeFailure(mediaInfo));
  
  if (mediaInfo.success === false) {
    return risks;
  }

  risks.push(...detectVFRRisk(mediaInfo));
  risks.push(...detectAudioRisks(mediaInfo));
  risks.push(...detectSubtitleRisks(mediaInfo));
  risks.push(...detectVideoRisks(mediaInfo));

  return risks.sort((a, b) => b.level.weight - a.level.weight);
}

function calculateRiskScore(risks) {
  if (risks.length === 0) return { score: 0, level: 'SAFE' };

  const totalWeight = risks.reduce((sum, r) => sum + r.level.weight, 0);
  const maxWeight = Math.max(...risks.map(r => r.level.weight));

  let overallLevel = 'SAFE';
  if (maxWeight >= RISK_LEVELS.CRITICAL.weight) {
    overallLevel = 'CRITICAL';
  } else if (maxWeight >= RISK_LEVELS.HIGH.weight) {
    overallLevel = 'HIGH';
  } else if (maxWeight >= RISK_LEVELS.MEDIUM.weight) {
    overallLevel = 'MEDIUM';
  } else if (maxWeight >= RISK_LEVELS.LOW.weight) {
    overallLevel = 'LOW';
  }

  return {
    score: Math.round(totalWeight / risks.length),
    maxRiskWeight: maxWeight,
    riskCount: risks.length,
    overallLevel,
    criticalCount: risks.filter(r => r.level.name === 'CRITICAL').length,
    highCount: risks.filter(r => r.level.name === 'HIGH').length,
    mediumCount: risks.filter(r => r.level.name === 'MEDIUM').length,
    lowCount: risks.filter(r => r.level.name === 'LOW').length
  };
}

function matchFailureSamples(risks) {
  const riskTypes = new Set(risks.map(r => r.type));
  const matchedSamples = [];

  for (const sample of FAILURE_SAMPLES) {
    const matches = sample.riskTypes.filter(t => riskTypes.has(t));
    if (matches.length > 0) {
      matchedSamples.push({
        ...sample,
        matchedRiskTypes: matches,
        matchScore: matches.length / sample.riskTypes.length
      });
    }
  }

  return matchedSamples.sort((a, b) => b.matchScore - a.matchScore);
}

module.exports = {
  RISK_LEVELS,
  RISK_TYPES,
  FAILURE_SAMPLES,
  detectVFRRisk,
  detectAudioRisks,
  detectSubtitleRisks,
  detectVideoRisks,
  detectProbeFailure,
  detectAllRisks,
  calculateRiskScore,
  matchFailureSamples
};
