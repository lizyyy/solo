export type EmotionTag =
  | '欢快'
  | '舒缓'
  | '紧张'
  | '悲伤'
  | '激昂'
  | '温馨'
  | '神秘'
  | '其他'
  | '';

export type ExceptionType = 'auth_expired' | 'timecode_mismatch' | 'duplicate_track';

export type SourceType = '曲目表' | '音频文件' | '合同截图' | '群聊批注';

export type MaterialStatus = 'pending' | 'reviewed' | 'exception' | 'resolved';

export interface MaterialException {
  type: ExceptionType;
  description: string;
  detectedAt: string;
  resolved: boolean;
}

export interface AudioMaterial {
  id: string;
  fileName: string;
  trackName: string;
  emotionTag: EmotionTag;
  remark: string;
  source: SourceType;
  processedAt: string;
  processedBy: string;
  status: MaterialStatus;
  exceptions: MaterialException[];
  originalSource: string;
  authorizationDate?: string;
  timecode?: string;
}

export interface FilterState {
  emotionTag: EmotionTag | 'all';
  status: MaterialStatus | 'all';
  source: SourceType | 'all';
  exceptionType: ExceptionType | 'all';
  dateRange: { start: string; end: string } | null;
  searchKeyword: string;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

export const EMOTION_TAGS: EmotionTag[] = ['欢快', '舒缓', '紧张', '悲伤', '激昂', '温馨', '神秘', '其他'];

export const SOURCE_TYPES: SourceType[] = ['曲目表', '音频文件', '合同截图', '群聊批注'];

export const EXCEPTION_TYPES: { type: ExceptionType; label: string; color: string }[] = [
  { type: 'auth_expired', label: '授权过期', color: 'red' },
  { type: 'timecode_mismatch', label: '时码错位', color: 'amber' },
  { type: 'duplicate_track', label: '重复曲目', color: 'purple' },
];

export const STATUS_LABELS: Record<MaterialStatus, string> = {
  pending: '待复核',
  reviewed: '已复核',
  exception: '有异常',
  resolved: '已解决',
};
