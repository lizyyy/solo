const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const DEFAULT_TARGET_PROFILES = {
  '1080p': {
    name: '1080p',
    width: 1920,
    height: 1080,
    videoCodec: 'h264',
    audioCodec: 'aac',
    defaultBitrate: 5000000,
    minBitrate: 3000000,
    maxBitrate: 8000000,
    audioBitrate: 192000,
    audioChannels: 2
  },
  '720p': {
    name: '720p',
    width: 1280,
    height: 720,
    videoCodec: 'h264',
    audioCodec: 'aac',
    defaultBitrate: 2500000,
    minBitrate: 1500000,
    maxBitrate: 4000000,
    audioBitrate: 128000,
    audioChannels: 2
  },
  '480p': {
    name: '480p',
    width: 854,
    height: 480,
    videoCodec: 'h264',
    audioCodec: 'aac',
    defaultBitrate: 1000000,
    minBitrate: 500000,
    maxBitrate: 1500000,
    audioBitrate: 96000,
    audioChannels: 2
  },
  '4k': {
    name: '4k',
    width: 3840,
    height: 2160,
    videoCodec: 'h264',
    audioCodec: 'aac',
    defaultBitrate: 15000000,
    minBitrate: 10000000,
    maxBitrate: 25000000,
    audioBitrate: 256000,
    audioChannels: 2
  }
};

const DEFAULT_BITRATE_RULES = [
  {
    id: 'high_motion',
    name: '高动态内容',
    conditions: {
      resolutionMin: 1080,
      frameRateMin: 50
    },
    multiplier: 1.5,
    priority: 10
  },
  {
    id: 'low_motion',
    name: '低动态内容',
    conditions: {
      frameRateMax: 25
    },
    multiplier: 0.8,
    priority: 5
  },
  {
    id: 'source_high_quality',
    name: '源文件高质量',
    conditions: {
      sourceBitrateRatioMin: 1.5
    },
    multiplier: 1.2,
    priority: 8
  },
  {
    id: 'source_low_quality',
    name: '源文件低质量',
    conditions: {
      sourceBitrateRatioMax: 0.8
    },
    multiplier: 0.9,
    priority: 7
  },
  {
    id: 'vfr_content',
    name: '可变帧率内容',
    conditions: {
      isVFR: true
    },
    multiplier: 1.1,
    priority: 9
  }
];

function loadConfig(configPath) {
  if (!fs.existsSync(configPath)) {
    return null;
  }

  const ext = path.extname(configPath).toLowerCase();
  const content = fs.readFileSync(configPath, 'utf8');

  if (ext === '.yaml' || ext === '.yml') {
    return yaml.load(content);
  } else if (ext === '.json' || ext === '.json5') {
    return require('json5').parse(content);
  }

  return JSON.parse(content);
}

function mergeWithDefaults(config) {
  const profiles = { ...DEFAULT_TARGET_PROFILES };
  const rules = [...DEFAULT_BITRATE_RULES];

  if (config?.targetProfiles) {
    for (const [key, value] of Object.entries(config.targetProfiles)) {
      profiles[key] = { ...profiles[key], ...value };
    }
  }

  if (config?.bitrateRules) {
    rules.push(...config.bitrateRules);
  }

  return { profiles, rules };
}

function matchTargetProfile(mediaInfo, targetSpec, profiles) {
  const mainVideo = mediaInfo.video[0];
  if (!mainVideo) return null;

  if (targetSpec && profiles[targetSpec]) {
    return profiles[targetSpec];
  }

  const height = mainVideo.height || 0;

  if (height >= 2160) return profiles['4k'];
  if (height >= 1080) return profiles['1080p'];
  if (height >= 720) return profiles['720p'];
  return profiles['480p'];
}

function evaluateCondition(mediaInfo, targetProfile, condition) {
  const mainVideo = mediaInfo.video[0] || {};
  const sourceBitrate = mainVideo.bitRate || mediaInfo.format?.bitRate || 0;
  const targetBitrate = targetProfile?.defaultBitrate || sourceBitrate;

  if (condition.resolutionMin && mainVideo.height < condition.resolutionMin) {
    return false;
  }
  if (condition.resolutionMax && mainVideo.height > condition.resolutionMax) {
    return false;
  }
  if (condition.frameRateMin) {
    const frameRate = mainVideo.avgFrameRate || mainVideo.frameRate || 0;
    if (frameRate < condition.frameRateMin) return false;
  }
  if (condition.frameRateMax) {
    const frameRate = mainVideo.avgFrameRate || mainVideo.frameRate || 0;
    if (frameRate > condition.frameRateMax) return false;
  }
  if (condition.sourceBitrateRatioMin !== undefined) {
    const ratio = sourceBitrate / targetBitrate;
    if (ratio < condition.sourceBitrateRatioMin) return false;
  }
  if (condition.sourceBitrateRatioMax !== undefined) {
    const ratio = sourceBitrate / targetBitrate;
    if (ratio > condition.sourceBitrateRatioMax) return false;
  }
  if (condition.isVFR !== undefined && mediaInfo.frameRateAnalysis?.isVFR !== condition.isVFR) {
    return false;
  }
  if (condition.hasAudio !== undefined && mediaInfo.hasAudio !== condition.hasAudio) {
    return false;
  }
  if (condition.audioTrackMin !== undefined && (mediaInfo.audioTrackCount || 0) < condition.audioTrackMin) {
    return false;
  }
  if (condition.subtitleMin !== undefined && (mediaInfo.subtitleTrackCount || 0) < condition.subtitleMin) {
    return false;
  }

  return true;
}

function matchBitrateRules(mediaInfo, targetProfile, rules) {
  const matchedRules = [];

  for (const rule of rules) {
    const conditions = rule.conditions || {};
    let matched = true;

    for (const [key, value] of Object.entries(conditions)) {
      if (!evaluateCondition(mediaInfo, targetProfile, { [key]: value })) {
        matched = false;
        break;
      }
    }

    if (matched) {
      matchedRules.push(rule);
    }
  }

  return matchedRules.sort((a, b) => (b.priority || 0) - (a.priority || 0));
}

function calculateTargetBitrate(mediaInfo, targetProfile, matchedRules, options = {}) {
  const { customBitrate = null, bitrateMultiplier = 1 } = options;

  if (customBitrate) {
    return {
      videoBitrate: customBitrate,
      audioBitrate: targetProfile.audioBitrate,
      totalBitrate: customBitrate + targetProfile.audioBitrate,
      method: 'custom',
      matchedRules: []
    };
  }

  let baseBitrate = targetProfile.defaultBitrate;
  const appliedRules = [];

  for (const rule of matchedRules) {
    if (rule.multiplier !== undefined) {
      baseBitrate *= rule.multiplier;
      appliedRules.push({
        id: rule.id,
        name: rule.name,
        multiplier: rule.multiplier
      });
    }
    if (rule.absoluteBitrate !== undefined) {
      baseBitrate = rule.absoluteBitrate;
      appliedRules.push({
        id: rule.id,
        name: rule.name,
        absoluteBitrate: rule.absoluteBitrate
      });
    }
  }

  baseBitrate = Math.max(targetProfile.minBitrate, Math.min(targetProfile.maxBitrate, baseBitrate));
  baseBitrate *= bitrateMultiplier;

  return {
    videoBitrate: Math.round(baseBitrate),
    audioBitrate: targetProfile.audioBitrate,
    totalBitrate: Math.round(baseBitrate + targetProfile.audioBitrate),
    method: 'rule_based',
    matchedRules: appliedRules
  };
}

function estimateFileSize(durationSeconds, totalBitrate) {
  const bytes = (durationSeconds * totalBitrate) / 8;
  return {
    bytes: Math.round(bytes),
    kilobytes: Math.round(bytes / 1024),
    megabytes: Math.round((bytes / 1024 / 1024) * 100) / 100,
    gigabytes: Math.round((bytes / 1024 / 1024 / 1024) * 1000) / 1000
  };
}

function generateTranscodeCommand(mediaInfo, targetProfile, bitrateInfo, options = {}) {
  const { outputDir = './output', extraOptions = '' } = options;
  const mainVideo = mediaInfo.video[0];
  const inputPath = mediaInfo.path;
  const outputName = path.basename(inputPath, path.extname(inputPath)) + '_transcoded.mp4';
  const outputPath = path.join(outputDir, outputName);

  const videoFilter = [];
  if (mainVideo && mainVideo.height > targetProfile.height) {
    videoFilter.push(`scale=-2:${targetProfile.height}`);
  }

  const audioMapping = [];
  const audioOptions = [];
  
  if (mediaInfo.audio.length > 0) {
    audioMapping.push('-map 0:a:0');
    audioOptions.push(`-b:a ${bitrateInfo.audioBitrate}`);
    audioOptions.push(`-ac ${targetProfile.audioChannels}`);
  } else {
    audioOptions.push('-an');
  }

  const vfOptions = videoFilter.length > 0 ? `-vf "${videoFilter.join(',')}"` : '';

  const parts = [
    'ffmpeg',
    '-i', `"${inputPath}"`,
    '-c:v', targetProfile.videoCodec,
    '-b:v', bitrateInfo.videoBitrate,
    vfOptions,
    '-c:a', mediaInfo.hasAudio ? targetProfile.audioCodec : 'copy',
    audioOptions.join(' '),
    audioMapping.join(' '),
    extraOptions,
    `"${outputPath}"`
  ];

  return {
    command: parts.filter(Boolean).join(' '),
    inputPath,
    outputPath,
    videoCodec: targetProfile.videoCodec,
    audioCodec: targetProfile.audioCodec
  };
}

module.exports = {
  DEFAULT_TARGET_PROFILES,
  DEFAULT_BITRATE_RULES,
  loadConfig,
  mergeWithDefaults,
  matchTargetProfile,
  matchBitrateRules,
  calculateTargetBitrate,
  estimateFileSize,
  generateTranscodeCommand,
  evaluateCondition
};
