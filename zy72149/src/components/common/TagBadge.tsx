import type { EmotionTag, ExceptionType, MaterialStatus, SourceType } from '../../types';

interface TagBadgeProps {
  type: 'emotion' | 'status' | 'source' | 'exception';
  value: string;
}

const emotionColors: Record<EmotionTag, string> = {
  '欢快': 'bg-yellow-100 text-yellow-700 border-yellow-200',
  '舒缓': 'bg-green-100 text-green-700 border-green-200',
  '紧张': 'bg-red-100 text-red-700 border-red-200',
  '悲伤': 'bg-blue-100 text-blue-700 border-blue-200',
  '激昂': 'bg-orange-100 text-orange-700 border-orange-200',
  '温馨': 'bg-pink-100 text-pink-700 border-pink-200',
  '神秘': 'bg-purple-100 text-purple-700 border-purple-200',
  '其他': 'bg-gray-100 text-gray-700 border-gray-200',
  '': 'bg-gray-100 text-gray-400 border-gray-200',
};

const statusColors: Record<MaterialStatus, string> = {
  pending: 'bg-gray-100 text-gray-600 border-gray-200',
  reviewed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  exception: 'bg-red-100 text-red-700 border-red-200',
  resolved: 'bg-blue-100 text-blue-700 border-blue-200',
};

const sourceColors: Record<SourceType, string> = {
  '曲目表': 'bg-slate-100 text-slate-700 border-slate-200',
  '音频文件': 'bg-cyan-100 text-cyan-700 border-cyan-200',
  '合同截图': 'bg-amber-100 text-amber-700 border-amber-200',
  '群聊批注': 'bg-teal-100 text-teal-700 border-teal-200',
};

const exceptionColors: Record<ExceptionType, string> = {
  auth_expired: 'bg-red-100 text-red-700 border-red-200',
  timecode_mismatch: 'bg-amber-100 text-amber-700 border-amber-200',
  duplicate_track: 'bg-violet-100 text-violet-700 border-violet-200',
};

const statusLabels: Record<MaterialStatus, string> = {
  pending: '待复核',
  reviewed: '已复核',
  exception: '有异常',
  resolved: '已解决',
};

const exceptionLabels: Record<ExceptionType, string> = {
  auth_expired: '授权过期',
  timecode_mismatch: '时码错位',
  duplicate_track: '重复曲目',
};

const TagBadge: React.FC<TagBadgeProps> = ({ type, value }) => {
  let colorClass = 'bg-gray-100 text-gray-600 border-gray-200';
  let displayValue = value;

  switch (type) {
    case 'emotion':
      colorClass = emotionColors[value as EmotionTag] || colorClass;
      displayValue = value || '未标注';
      break;
    case 'status':
      colorClass = statusColors[value as MaterialStatus] || colorClass;
      displayValue = statusLabels[value as MaterialStatus] || value;
      break;
    case 'source':
      colorClass = sourceColors[value as SourceType] || colorClass;
      break;
    case 'exception':
      colorClass = exceptionColors[value as ExceptionType] || colorClass;
      displayValue = exceptionLabels[value as ExceptionType] || value;
      break;
  }

  return (
    <span
      className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-md border ${colorClass}`}
    >
      {displayValue}
    </span>
  );
};

export default TagBadge;
