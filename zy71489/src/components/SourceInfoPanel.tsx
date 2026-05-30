import { Vote, FileText, User, ChevronRight } from 'lucide-react';
import type { SourceInfo, Copyright } from '@shared/types';
import { cn } from '@/lib/utils';

interface SourceInfoPanelProps {
  voteSource?: SourceInfo;
  copyrightSource?: SourceInfo;
  trackSource: SourceInfo;
  voteCount?: number;
  copyright?: Copyright;
}

function SourceRow({
  icon,
  label,
  children,
  defaultOpen = true
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <div className="border-l-2 border-neutral-700 ml-2 pl-4 py-2">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 rounded bg-neutral-800 flex items-center justify-center text-gold">
          {icon}
        </div>
        <span className="text-sm font-medium text-neutral-300">{label}</span>
      </div>
      <div className="space-y-1.5 animate-fade-in-up">
        {children}
      </div>
    </div>
  );
}

function InfoItem({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-neutral-500 w-20 shrink-0">{label}</span>
      <ChevronRight size={12} className="text-neutral-600 shrink-0" />
      <span
        className={cn(
          'text-neutral-300 truncate',
          mono && 'font-mono text-gold'
        )}
      >
        {value}
      </span>
    </div>
  );
}

export default function SourceInfoPanel({
  voteSource,
  copyrightSource,
  trackSource,
  voteCount = 0,
  copyright
}: SourceInfoPanelProps) {
  const getSourceTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'manual': '手动录入',
      'csv-import': 'CSV 导入',
      'api': 'API 同步'
    };
    return labels[type] || type;
  };

  const getCopyrightStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      'active': '有效',
      'expired': '已过期',
      'pending': '待审核',
      'restricted': '受限'
    };
    return labels[status] || status;
  };

  return (
    <div className="bg-neutral-950/50 rounded-stage border border-neutral-800 p-4 space-y-3">
      <div className="flex items-center gap-2 mb-3">
        <FileText size={16} className="text-gold" />
        <span className="text-sm font-semibold text-gold">数据来源追溯</span>
      </div>

      {voteSource && (
        <SourceRow icon={<Vote size={14} />} label={`投票来源 (${voteCount} 票)`}>
          <InfoItem label="来源文件" value={voteSource.fileName || '—'} mono />
          <InfoItem label="数据行号" value={`第 ${voteSource.lineNumber} 行`} mono />
          <InfoItem label="导入时间" value={voteSource.importedAt} />
          <InfoItem label="导入人" value={voteSource.importedBy} />
          <InfoItem label="来源类型" value={getSourceTypeLabel(voteSource.sourceType)} />
        </SourceRow>
      )}

      {copyrightSource && copyright && (
        <SourceRow
          icon={<FileText size={14} />}
          label={`版权来源 (${getCopyrightStatusLabel(copyright.status)})`}
        >
          <InfoItem label="来源文件" value={copyrightSource.fileName || '—'} mono />
          <InfoItem label="数据行号" value={`第 ${copyrightSource.lineNumber} 行`} mono />
          <InfoItem label="许可证号" value={copyright.licenseNumber || '—'} mono />
          <InfoItem label="过期时间" value={copyright.expiredAt || '长期有效'} />
          <InfoItem label="预警等级" value={copyright.warningLevel === 'high' ? '高' : copyright.warningLevel === 'medium' ? '中' : '低'} />
        </SourceRow>
      )}

      <SourceRow icon={<User size={14} />} label="录入来源">
        <InfoItem label="操作人" value={trackSource.importedBy} />
        <InfoItem label="录入时间" value={trackSource.importedAt} />
        <InfoItem label="来源类型" value={getSourceTypeLabel(trackSource.sourceType)} />
        {trackSource.fileName && (
          <InfoItem label="来源文件" value={trackSource.fileName} mono />
        )}
      </SourceRow>
    </div>
  );
}
