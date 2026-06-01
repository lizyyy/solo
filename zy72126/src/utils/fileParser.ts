import type { ParsedFileName } from '@/types';

export const parseFileName = (fileName: string): ParsedFileName => {
  const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
  
  const patterns = [
    /^(?<channelNo>\d+)[\s_\-]+(?<trackName>[\u4e00-\u9fa5\w\s]+?)(?:[\s_\-]+(?<artist>[\u4e00-\u9fa5\w\s]+?))?(?:[\s_\-]+(?<version>v\d+|live|demo|remix))?(?:[\s_\-]+(?<duration>\d+[:：]\d+))?$/i,
    /^(?<trackName>[\u4e00-\u9fa5\w\s]+?)(?:[\s_\-]+(?<artist>[\u4e00-\u9fa5\w\s]+?))?(?:[\s_\-]+(?<channelNo>ch\d+|\d+))?$/i,
    /^(?<artist>[\u4e00-\u9fa5\w\s]+?)[\s_\-]+(?<trackName>[\u4e00-\u9fa5\w\s]+?)$/i,
  ];

  for (const pattern of patterns) {
    const match = nameWithoutExt.match(pattern);
    if (match?.groups) {
      const result: ParsedFileName = {
        trackName: match.groups.trackName?.trim() || nameWithoutExt,
      };
      if (match.groups.artist) result.artist = match.groups.artist.trim();
      if (match.groups.version) result.version = match.groups.version.trim();
      if (match.groups.channelNo) result.channelNo = match.groups.channelNo.trim();
      if (match.groups.duration) result.duration = match.groups.duration.trim();
      return result;
    }
  }

  return { trackName: nameWithoutExt };
};

export const validateAudioFile = (file: File): { valid: boolean; reason?: string } => {
  const validExtensions = ['.mp3', '.wav', '.flac', '.aac', '.m4a', '.ogg'];
  const validMimeTypes = [
    'audio/mpeg',
    'audio/wav',
    'audio/flac',
    'audio/aac',
    'audio/mp4',
    'audio/ogg',
  ];

  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
  
  if (!validExtensions.includes(ext)) {
    return { valid: false, reason: `不支持的文件格式: ${ext}，仅支持 ${validExtensions.join(', ')}` };
  }

  if (file.size === 0) {
    return { valid: false, reason: '文件为空' };
  }

  const maxSize = 500 * 1024 * 1024;
  if (file.size > maxSize) {
    return { valid: false, reason: `文件过大 (${(file.size / 1024 / 1024).toFixed(2)}MB)，最大支持 500MB` };
  }

  return { valid: true };
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

export const detectConflicts = (
  existingTrack: any,
  newData: any
): Array<{ field: string; valueA: any; valueB: any; suggestedAction: string }> => {
  const conflicts: Array<{ field: string; valueA: any; valueB: any; suggestedAction: string }> = [];
  const fieldsToCheck = ['trackName', 'artist', 'duration', 'channelNo'];

  for (const field of fieldsToCheck) {
    const existing = existingTrack[field];
    const newVal = newData[field];
    
    if (existing && newVal && existing !== newVal) {
      let suggestedAction = '';
      if (field === 'trackName') {
        suggestedAction = `建议使用更完整的名称：${existing.length > newVal.length ? existing : newVal}`;
      } else if (field === 'channelNo') {
        suggestedAction = '建议确认舞台通道表记录，使用最新的通道号';
      } else {
        suggestedAction = '建议人工核对原始材料后裁决';
      }
      
      conflicts.push({ field, valueA: existing, valueB: newVal, suggestedAction });
    }
  }

  return conflicts;
};
