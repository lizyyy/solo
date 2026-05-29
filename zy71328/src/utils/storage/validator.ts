import type { ProcessConfig, ProtectedRegion } from '../../types';

export function validateProcessConfig(config: ProcessConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (config.targetLufs < -30 || config.targetLufs > -10) {
    errors.push(`响度目标必须在 -30 到 -10 LUFS 之间，当前值: ${config.targetLufs}`);
  }
  
  if (config.truePeakLimit < -6 || config.truePeakLimit > 0) {
    errors.push(`峰值限制必须在 -6 到 0 dBTP 之间，当前值: ${config.truePeakLimit}`);
  }
  
  if (config.lufsTolerance < 0 || config.lufsTolerance > 5) {
    errors.push(`响度容差必须在 0 到 5 LUFS 之间，当前值: ${config.lufsTolerance}`);
  }
  
  if (config.compressorRatio < 1 || config.compressorRatio > 20) {
    errors.push(`压缩比必须在 1 到 20 之间，当前值: ${config.compressorRatio}`);
  }
  
  if (config.attackTime < 0.1 || config.attackTime > 100) {
    errors.push(`启动时间必须在 0.1 到 100 ms 之间，当前值: ${config.attackTime}`);
  }
  
  if (config.releaseTime < 10 || config.releaseTime > 1000) {
    errors.push(`释放时间必须在 10 到 1000 ms 之间，当前值: ${config.releaseTime}`);
  }
  
  if (config.introDuration < 0 || config.introDuration > 60) {
    errors.push(`片头时长必须在 0 到 60 秒之间，当前值: ${config.introDuration}`);
  }
  
  if (config.outroDuration < 0 || config.outroDuration > 60) {
    errors.push(`片尾时长必须在 0 到 60 秒之间，当前值: ${config.outroDuration}`);
  }
  
  if (config.fadeInDuration < 0 || config.fadeInDuration > 10) {
    errors.push(`淡入时长必须在 0 到 10 秒之间，当前值: ${config.fadeInDuration}`);
  }
  
  if (config.fadeOutDuration < 0 || config.fadeOutDuration > 10) {
    errors.push(`淡出时长必须在 0 到 10 秒之间，当前值: ${config.fadeOutDuration}`);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

export function validateProtectedRegion(region: ProtectedRegion, duration: number): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (region.startTime < 0) {
    errors.push(`开始时间不能为负数，当前值: ${region.startTime}`);
  }
  
  if (region.endTime > duration) {
    errors.push(`结束时间不能超过音频总时长 ${duration} 秒，当前值: ${region.endTime}`);
  }
  
  if (region.startTime >= region.endTime) {
    errors.push(`开始时间必须小于结束时间，start: ${region.startTime}, end: ${region.endTime}`);
  }
  
  if (region.endTime - region.startTime < 0.1) {
    errors.push(`保护区域时长至少为 0.1 秒，当前时长: ${region.endTime - region.startTime}`);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
