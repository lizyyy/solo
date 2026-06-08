import type { ParsedFileName, ChannelTableEntry } from '@/types';

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

const normalizeStr = (s: string): string =>
  s.trim().toLowerCase().replace(/[\s_\-]/g, '');

export const matchToChannelTable = (
  parsed: ParsedFileName,
  channelTable: ChannelTableEntry[]
): ChannelTableEntry | null => {
  if (parsed.channelNo) {
    const byNo = channelTable.find(
      (e) => e.channelNo === parsed.channelNo || normalizeStr(e.channelNo) === normalizeStr(parsed.channelNo!)
    );
    if (byNo) return byNo;
  }

  if (parsed.trackName) {
    const normName = normalizeStr(parsed.trackName);
    const byName = channelTable.find(
      (e) => normalizeStr(e.trackName) === normName
    );
    if (byName) return byName;
  }

  if (parsed.artist && parsed.trackName) {
    const normArtist = normalizeStr(parsed.artist);
    const normTrack = normalizeStr(parsed.trackName);
    const byBoth = channelTable.find(
      (e) =>
        e.artist &&
        normalizeStr(e.artist) === normArtist &&
        normalizeStr(e.trackName) === normTrack
    );
    if (byBoth) return byBoth;
  }

  return null;
};

export interface ConflictDetail {
  field: string;
  valueA: any;
  valueB: any;
  suggestedAction: string;
}

export const detectConflicts = (
  channelEntry: ChannelTableEntry,
  newData: ParsedFileName & { fileName: string }
): ConflictDetail[] => {
  const conflicts: ConflictDetail[] = [];

  const fieldsToCheck: Array<{
    key: string;
    channelVal: any;
    newVal: any;
    label: string;
  }> = [
    { key: 'trackName', channelVal: channelEntry.trackName, newVal: newData.trackName, label: '曲目名称' },
    { key: 'artist', channelVal: channelEntry.artist, newVal: newData.artist, label: '艺术家' },
    { key: 'duration', channelVal: channelEntry.duration, newVal: newData.duration, label: '时长' },
    { key: 'channelNo', channelVal: channelEntry.channelNo, newVal: newData.channelNo, label: '通道号' },
  ];

  for (const { key, channelVal, newVal, label } of fieldsToCheck) {
    if (channelVal && newVal && normalizeStr(String(channelVal)) !== normalizeStr(String(newVal))) {
      let suggestedAction = '';
      if (key === 'trackName') {
        if (normalizeStr(String(channelVal)).includes(normalizeStr(String(newVal))) || normalizeStr(String(newVal)).includes(normalizeStr(String(channelVal)))) {
          suggestedAction = `通道表为"${channelVal}"，文件为"${newVal}"，疑似同一曲目不同写法，建议核对后保留更完整名称`;
        } else {
          suggestedAction = `通道表记录"${label}"为"${channelVal}"，文件解析为"${newVal}"，内容完全不同，建议核对原始材料`;
        }
      } else if (key === 'channelNo') {
        suggestedAction = `通道号不一致（通道表: ${channelVal}, 文件: ${newVal}），建议以舞台通道表为准`;
      } else if (key === 'artist') {
        if (normalizeStr(String(channelVal)).includes(normalizeStr(String(newVal))) || normalizeStr(String(newVal)).includes(normalizeStr(String(channelVal)))) {
          suggestedAction = `艺术家名写法不同（通道表: ${channelVal}, 文件: ${newVal}），疑似同一人，建议统一`;
        } else {
          suggestedAction = `艺术家不一致（通道表: ${channelVal}, 文件: ${newVal}），建议人工核对`;
        }
      } else {
        suggestedAction = `${label}不一致（通道表: ${channelVal}, 文件: ${newVal}），建议人工核对原始材料后裁决`;
      }

      conflicts.push({ field: key, valueA: channelVal, valueB: newVal, suggestedAction });
    }
  }

  return conflicts;
};

export const findMissingEntries = (
  channelTable: ChannelTableEntry[],
  tracks: Array<{ channelTableId?: string; trackName: string; fileName: string }>
): ChannelTableEntry[] => {
  const matchedIds = new Set(
    tracks.filter((t) => t.channelTableId).map((t) => t.channelTableId)
  );
  return channelTable.filter((e) => !matchedIds.has(e.id));
};
