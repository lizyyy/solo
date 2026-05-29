import { AlertOctagon } from 'lucide-react';

interface ConflictBadgeProps {
  versionCount: number;
  onClick?: (e?: React.MouseEvent) => void;
}

export function ConflictBadge({ versionCount, onClick }: ConflictBadgeProps) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded border border-red-300 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 hover:bg-red-100 transition-colors"
      title={`存在 ${versionCount} 个版本冲突，点击查看详情`}
    >
      <AlertOctagon size={12} />
      冲突 v{versionCount}
    </button>
  );
}
