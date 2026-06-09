import type { WarningLevel, RecordStatus } from '@/types';
import { CheckCircle2, AlertTriangle, OctagonX, Clock, Paperclip, MessageSquareText } from 'lucide-react';

export function LevelBadge({ level, label }: { level: WarningLevel; label?: string }) {
  const map = {
    green: { cls: 'pill-level-green', Icon: CheckCircle2, text: label || '正常' },
    yellow: { cls: 'pill-level-yellow', Icon: AlertTriangle, text: label || '黄警' },
    red: { cls: 'pill-level-red', Icon: OctagonX, text: label || '红警' },
  };
  const { cls, Icon, text } = map[level];
  return (
    <span className={cls}>
      <Icon className="w-3 h-3" />
      {text}
    </span>
  );
}

export function StatusBadge({ status }: { status: RecordStatus }) {
  if (status === 'pending') {
    return (
      <span className="pill-level-pending">
        <Clock className="w-3 h-3" />
        待人工确认
      </span>
    );
  }
  if (status === 'confirmed') {
    return (
      <span className="pill-level-green">
        <CheckCircle2 className="w-3 h-3" />
        已采信
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-industrial-100 text-industrial-600">
      正常录入
    </span>
  );
}

export function LateAttachmentTag() {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-alert-orange/15 text-[#b54a1e] border border-alert-orange/30"
      title="附件晚到"
    >
      <Paperclip className="w-3 h-3" />
      附件晚到
    </span>
  );
}

export function BackfilledNoteTag() {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-alert-blue/15 text-[#0a56a5] border border-alert-blue/30"
      title="后补说明"
    >
      <MessageSquareText className="w-3 h-3" />
      后补说明
    </span>
  );
}
