import { FileText, Users, ShieldCheck, Clock, User } from 'lucide-react';
import { ModificationLog, EntityType } from '../../shared/types';

interface ModificationLogCardProps {
  log: ModificationLog;
}

const ENTITY_ICONS: Record<EntityType, React.ComponentType<{ className?: string }>> = {
  rule: FileText,
  customer: Users,
  whitelist: ShieldCheck
};

const ENTITY_LABELS: Record<EntityType, string> = {
  rule: '规则',
  customer: '客户',
  whitelist: '白名单'
};

const ENTITY_COLORS: Record<EntityType, string> = {
  rule: 'text-primary-light bg-primary-light/20',
  customer: 'text-success bg-success/20',
  whitelist: 'text-warning bg-warning/20'
};

export default function ModificationLogCard({ log }: ModificationLogCardProps) {
  const Icon = ENTITY_ICONS[log.entityType];
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="bg-dark-100 rounded-xl border border-dark-200 overflow-hidden transition-all hover:shadow-lg hover:shadow-dark-200/20">
      <div className="p-4">
        <div className="flex items-start gap-3 mb-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${ENTITY_COLORS[log.entityType]}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-dark-200 text-slate-300">
                {ENTITY_LABELS[log.entityType]}
              </span>
              <span className="text-xs text-slate-500">·</span>
              <span className="text-xs text-slate-400">{log.field}</span>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <div className="flex items-center gap-1">
                <User className="w-3 h-3" />
                <span>{log.modifiedBy}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>{formatDate(log.createdAt)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <div className="text-xs text-slate-500 mb-1">旧值</div>
            <div className="text-sm text-slate-300 px-2 py-1.5 rounded bg-red-500/10 border border-red-500/20 text-red-400 font-mono">
              {log.oldValue || '-'}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">新值</div>
            <div className="text-sm text-slate-300 px-2 py-1.5 rounded bg-green-500/10 border border-green-500/20 text-green-400 font-mono">
              {log.newValue || '-'}
            </div>
          </div>
        </div>

        {log.reason && (
          <div className="bg-dark-200/50 rounded-lg p-3">
            <div className="text-xs text-slate-500 mb-1">修改理由</div>
            <div className="text-sm text-slate-300">{log.reason}</div>
          </div>
        )}
      </div>
    </div>
  );
}
