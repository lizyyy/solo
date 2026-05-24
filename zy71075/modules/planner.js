const path = require('path');
const probe = require('./probe');
const rules = require('./rules');
const risks = require('./risks');

async function generatePlan(input, options = {}) {
  const {
    targetProfile = null,
    customBitrate = null,
    bitrateMultiplier = 1,
    configPath = null,
    outputDir = './output',
    extraFFmpegOptions = ''
  } = options;

  const config = configPath ? rules.loadConfig(configPath) : null;
  const { profiles, rules: bitrateRules } = rules.mergeWithDefaults(config);

  if (targetProfile && !profiles[targetProfile]) {
    const availableProfiles = Object.keys(profiles).join(', ');
    throw new Error(`无效的目标规格: ${targetProfile}\n可用规格: ${availableProfiles}`);
  }

  let mediaFiles = [];

  if (Array.isArray(input)) {
    mediaFiles = input;
  } else if (typeof input === 'string') {
    const fs = require('fs');
    const stat = fs.statSync(input);
    
    if (stat.isDirectory()) {
      mediaFiles = await probe.probeDirectory(input, {
        concurrency: options.concurrency || 2
      });
    } else if (stat.isFile()) {
      if (input.endsWith('.json') || input.endsWith('.json5')) {
        mediaFiles = probe.loadProbeData(input);
      } else {
        mediaFiles = [await probe.probeFile(input)];
      }
    }
  }

  const results = [];
  let totalOriginalSize = 0;
  let totalEstimatedSize = 0;
  let totalDuration = 0;

  for (const mediaInfo of mediaFiles) {
    const result = processMediaFile(mediaInfo, {
      targetProfile,
      customBitrate,
      bitrateMultiplier,
      profiles,
      bitrateRules,
      outputDir,
      extraFFmpegOptions
    });
    
    results.push(result);
    
    if (mediaInfo.success) {
      totalOriginalSize += mediaInfo.format?.size || 0;
      totalDuration += mediaInfo.format?.duration || 0;
      totalEstimatedSize += result.estimatedSize?.bytes || 0;
    }
  }

  const summary = generateSummary(results, totalOriginalSize, totalEstimatedSize, totalDuration);

  return {
    generatedAt: new Date().toISOString(),
    version: '1.0.0',
    options: {
      targetProfile,
      customBitrate,
      bitrateMultiplier,
      configPath,
      outputDir
    },
    summary,
    files: results
  };
}

function processMediaFile(mediaInfo, options) {
  const {
    targetProfile,
    customBitrate,
    bitrateMultiplier,
    profiles,
    bitrateRules,
    outputDir,
    extraFFmpegOptions
  } = options;

  const detectedRisks = risks.detectAllRisks(mediaInfo);
  const riskScore = risks.calculateRiskScore(detectedRisks);
  const matchedSamples = risks.matchFailureSamples(detectedRisks);

  if (!mediaInfo.success) {
    return {
      file: mediaInfo.file,
      path: mediaInfo.path,
      success: false,
      error: mediaInfo.error,
      risks: detectedRisks,
      riskScore
    };
  }

  const matchedProfile = rules.matchTargetProfile(mediaInfo, targetProfile, profiles);
  const matchedRules = rules.matchBitrateRules(mediaInfo, matchedProfile, bitrateRules);
  const bitrateInfo = rules.calculateTargetBitrate(mediaInfo, matchedProfile, matchedRules, {
    customBitrate,
    bitrateMultiplier
  });

  const duration = mediaInfo.format?.duration || 0;
  const estimatedSize = rules.estimateFileSize(duration, bitrateInfo.totalBitrate);
  
  const command = rules.generateTranscodeCommand(mediaInfo, matchedProfile, bitrateInfo, {
    outputDir,
    extraOptions: extraFFmpegOptions
  });

  const originalSize = mediaInfo.format?.size || 0;
  const compressionRatio = estimatedSize.bytes > 0 ? originalSize / estimatedSize.bytes : 0;

  return {
    file: mediaInfo.file,
    path: mediaInfo.path,
    success: true,
    mediaInfo: {
      duration: duration,
      resolution: mediaInfo.video[0]?.resolution || 'unknown',
      sourceBitrate: mediaInfo.format?.bitRate || 0,
      videoCodec: mediaInfo.video[0]?.codec || 'unknown',
      audioCodec: mediaInfo.audio[0]?.codec || 'none',
      hasAudio: mediaInfo.hasAudio,
      audioTracks: mediaInfo.audioTrackCount,
      subtitleTracks: mediaInfo.subtitleTrackCount,
      isVFR: mediaInfo.frameRateAnalysis?.isVFR || false
    },
    targetProfile: {
      name: matchedProfile?.name,
      width: matchedProfile?.width,
      height: matchedProfile?.height,
      videoCodec: matchedProfile?.videoCodec,
      audioCodec: matchedProfile?.audioCodec
    },
    bitrate: {
      video: bitrateInfo.videoBitrate,
      audio: bitrateInfo.audioBitrate,
      total: bitrateInfo.totalBitrate,
      method: bitrateInfo.method,
      matchedRules: bitrateInfo.matchedRules
    },
    estimatedSize,
    originalSize: {
      bytes: originalSize,
      megabytes: Math.round((originalSize / 1024 / 1024) * 100) / 100
    },
    compressionRatio,
    risks: detectedRisks,
    riskScore,
    failureSamples: matchedSamples,
    command
  };
}

function generateSummary(results, totalOriginalSize, totalEstimatedSize, totalDuration) {
  const totalFiles = results.length;
  const successFiles = results.filter(r => r.success).length;
  const failedFiles = results.filter(r => !r.success).length;

  const riskStats = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    safe: 0
  };

  for (const result of results) {
    if (!result.success) {
      riskStats.critical++;
    } else {
      switch (result.riskScore.overallLevel) {
        case 'CRITICAL': riskStats.critical++; break;
        case 'HIGH': riskStats.high++; break;
        case 'MEDIUM': riskStats.medium++; break;
        case 'LOW': riskStats.low++; break;
        default: riskStats.safe++; break;
      }
    }
  }

  const failedSize = totalOriginalSize > 0 ? 1 - (totalEstimatedSize / totalOriginalSize) : 0;
  const spaceSaved = totalOriginalSize - totalEstimatedSize;

  const allRiskTypes = new Set();
  for (const result of results) {
    for (const risk of result.risks || []) {
      allRiskTypes.add(risk.type);
    }
  }

  return {
    totalFiles,
    successFiles,
    failedFiles,
    totalDuration,
    totalDurationFormatted: formatDuration(totalDuration),
    sizes: {
      original: {
        bytes: totalOriginalSize,
        megabytes: Math.round((totalOriginalSize / 1024 / 1024) * 100) / 100,
        gigabytes: Math.round((totalOriginalSize / 1024 / 1024 / 1024) * 1000) / 1000
      },
      estimated: {
        bytes: totalEstimatedSize,
        megabytes: Math.round((totalEstimatedSize / 1024 / 1024) * 100) / 100,
        gigabytes: Math.round((totalEstimatedSize / 1024 / 1024 / 1024) * 1000) / 1000
      },
      saved: {
        bytes: spaceSaved,
        megabytes: Math.round((spaceSaved / 1024 / 1024) * 100) / 100,
        gigabytes: Math.round((spaceSaved / 1024 / 1024 / 1024) * 1000) / 1000
      },
      compressionRatio: totalEstimatedSize > 0 ? totalOriginalSize / totalEstimatedSize : 0,
      reductionPercent: Math.round(failedSize * 10000) / 100
    },
    riskStats,
    detectedRiskTypes: Array.from(allRiskTypes),
    estimatedFailureRate: estimateFailureRate(results)
  };
}

function estimateFailureRate(results) {
  let totalRisk = 0;
  let sampleCount = 0;

  for (const result of results) {
    if (result.failureSamples && result.failureSamples.length > 0) {
      for (const sample of result.failureSamples) {
        totalRisk += sample.failureRate * sample.matchScore;
        sampleCount++;
      }
    }
  }

  return sampleCount > 0 ? Math.round((totalRisk / results.length) * 1000) / 10 : 0;
}

function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

function filterByRisk(plan, minLevel = 'MEDIUM') {
  const levelOrder = ['SAFE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  const minIndex = levelOrder.indexOf(minLevel);

  return plan.files.filter(file => {
    if (!file.success) return true;
    const fileLevelIndex = levelOrder.indexOf(file.riskScore.overallLevel);
    return fileLevelIndex >= minIndex;
  });
}

function exportBatchScript(plan, outputPath, options = {}) {
  const { includeRiskWarnings = true } = options;
  const fs = require('fs');

  const lines = [
    '#!/bin/bash',
    '# Auto-generated transcode batch script',
    `# Generated: ${new Date().toISOString()}`,
    `# Total files: ${plan.summary.totalFiles}`,
    `# Estimated output size: ${plan.summary.sizes.estimated.gigabytes} GB`,
    ''
  ];

  if (includeRiskWarnings) {
    lines.push('# RISK SUMMARY:');
    if (plan.summary.riskStats.critical > 0) {
      lines.push(`#   - CRITICAL risks: ${plan.summary.riskStats.critical} files`);
    }
    if (plan.summary.riskStats.high > 0) {
      lines.push(`#   - HIGH risks: ${plan.summary.riskStats.high} files`);
    }
    if (plan.summary.riskStats.medium > 0) {
      lines.push(`#   - MEDIUM risks: ${plan.summary.riskStats.medium} files`);
    }
    lines.push('');
  }

  lines.push('set -e');
  lines.push('');

  for (const file of plan.files) {
    if (!file.success || !file.command) continue;

    lines.push(`# File: ${file.file}`);
    lines.push(`# Risk level: ${file.riskScore.overallLevel}`);
    
    if (file.risks && file.risks.length > 0) {
      for (const risk of file.risks) {
        lines.push(`# WARNING [${risk.level.name}]: ${risk.title} - ${risk.message}`);
      }
    }
    
    lines.push(`# Estimated size: ${file.estimatedSize.megabytes} MB`);
    lines.push(file.command.command);
    lines.push('');
  }

  fs.writeFileSync(outputPath, lines.join('\n'));
  fs.chmodSync(outputPath, 0o755);
}

module.exports = {
  generatePlan,
  processMediaFile,
  generateSummary,
  formatDuration,
  filterByRisk,
  exportBatchScript,
  estimateFailureRate
};
