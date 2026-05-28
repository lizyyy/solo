import { useMemo } from 'react';
import {
  RotateCcw,
  ArrowRight,
  Clock,
  User,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useModificationStore } from '../../store';
import Badge from '../common/Badge';
import GlassPanel from '../common/GlassPanel';
import dayjs from 'dayjs';

interface ModificationHistoryProps {
  entityType?: string;
  entityId?: string;
  maxItems?: number;
  onRollback?: (modificationId: string) => void;
}

export default function ModificationHistory({
  entityType,
  entityId,
  maxItems = 20,
  onRollback,
}: ModificationHistoryProps) {
  const getModifications = useModificationStore((s) => s.getModifications);
  const rollbackModification = useModificationStore(
    (s) => s.rollbackModification
  );

  const modifications = useMemo(() => {
    const filters: {
      entityType?: 'shelf' | 'trajectory' | 'congestion' | 'charging';
      entityId?: string;
    } = {};
    if (entityType) {
      filters.entityType = entityType as 'shelf' | 'trajectory' | 'congestion' | 'charging';
    }
    if (entityId) {
      filters.entityId = entityId;
    }
    return getModifications(filters).slice(0, maxItems);
  }, [getModifications, entityType, entityId, maxItems]);

  const handleRollback = (modificationId: string) => {
    const reason = prompt('请输入回滚理由（至少10个字符）:');
    if (reason && reason.trim().length >= 10) {
      const success = rollbackModification(modificationId, reason.trim());
      if (success && onRollback) {
        onRollback(modificationId);
      }
    } else if (reason !== null) {
      alert('回滚理由至少需要10个字符');
    }
  };

  const entityLabel = (type: string) => {
    const map: Record<string, string> = {
      shelf: '货架',
      trajectory: '轨迹',
      congestion: '拥堵',
      charging: '充电',
    };
    return map[type] ?? type;
  };

  return (
    <GlassPanel
      title="修改历史"
      icon={<Clock className="w-4 h-4" />}
      className="w-80"
    >
      {modifications.length === 0 ? (
        <div className="text-center text-sm text-slate-500 py-6">
          暂无修改记录
        </div>
      ) : (
        <div className="space-y-0 relative">
          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-warehouse-border/30" />
          {modifications.map((mod) => (
            <div key={mod.id} className="relative pl-6 pb-4">
              <div
                className={cn(
                  'absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full border-2',
                  mod.isRollback
                    ? 'border-status-amber bg-status-amber/20'
                    : 'border-accent-blue bg-accent-blue/20'
                )}
              />

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant={mod.isRollback ? 'warning' : 'info'}>
                    {mod.isRollback ? '回滚' : '修改'}
                  </Badge>
                  <span className="text-xs text-slate-400 font-mono">
                    {dayjs(mod.modifiedAt).format('MM/DD HH:mm:ss')}
                  </span>
                </div>

                <div className="text-xs text-slate-300">
                  <span className="text-slate-500">
                    {entityLabel(mod.entityType)}
                  </span>
                  <span className="mx-1 text-slate-600">·</span>
                  <span className="font-mono text-accent-blue">
                    {mod.entityId.slice(0, 8)}
                  </span>
                </div>

                <div className="text-xs">
                  <span className="text-slate-400">字段: </span>
                  <span className="text-slate-200 font-mono">
                    {mod.fieldName}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-xs">
                  <span
                    className={cn(
                      'px-1.5 py-0.5 rounded bg-status-red/10 text-status-red font-mono line-through'
                    )}
                  >
                    {mod.oldValue.length > 20
                      ? mod.oldValue.slice(0, 20) + '...'
                      : mod.oldValue}
                  </span>
                  <ArrowRight className="w-3 h-3 text-slate-500 shrink-0" />
                  <span className="px-1.5 py-0.5 rounded bg-status-green/10 text-status-green font-mono">
                    {mod.newValue.length > 20
                      ? mod.newValue.slice(0, 20) + '...'
                      : mod.newValue}
                  </span>
                </div>

                <div className="text-xs text-slate-500 italic">
                  "{mod.reason}"
                </div>

                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-[10px] text-slate-500">
                    <User className="w-3 h-3" />
                    {mod.modifiedBy}
                  </span>
                  <button
                    onClick={() => handleRollback(mod.id)}
                    className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-status-amber transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    回滚
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </GlassPanel>
  );
}
