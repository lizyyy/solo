import type { HistoryItem } from '../../shared/types';

interface HistoryTimelineProps {
  history: HistoryItem[];
}

function actionText(action: string) {
  const map: Record<string, string> = {
    import: '导入',
    review: '审核',
    confirm: '确认灰度',
    reject: '驳回灰度',
    supplement: '补录',
    recalc: '重算',
  };
  return map[action] ?? action;
}

function actionColor(action: string) {
  switch (action) {
    case 'import':
    case 'supplement':
      return 'bg-blue-500 text-blue-100';
    case 'review':
      return 'bg-slate-500 text-slate-100';
    case 'confirm':
      return 'bg-emerald-500 text-emerald-100';
    case 'reject':
      return 'bg-red-500 text-red-100';
    case 'recalc':
      return 'bg-purple-500 text-purple-100';
    default:
      return 'bg-slate-500 text-slate-100';
  }
}

export default function HistoryTimeline({ history }: HistoryTimelineProps) {
  const sorted = [...history].sort((a, b) => b.at - a.at);

  return (
    <div className="relative">
      <div className="absolute left-2 top-1 bottom-1 w-px bg-white/10" />
      <ul className="space-y-4">
        {sorted.map((item) => (
          <li key={item.id} className="relative pl-8">
            <span
              className={`absolute left-0 top-1 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${actionColor(
                item.action,
              )}`}
            >
              {actionText(item.action).charAt(0)}
            </span>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium text-white">{actionText(item.action)}</span>
              <span className="text-xs text-slate-500">— {item.operator}</span>
            </div>
            <p className="text-xs text-slate-500 mb-1">
              {new Date(item.at).toLocaleString('zh-CN')}
            </p>
            {item.note && (
              <p className="text-sm text-slate-300 mb-1.5">{item.note}</p>
            )}
            {item.snapshot && Object.keys(item.snapshot).length > 0 && (
              <div className="px-2.5 py-1.5 bg-slate-800/50 rounded-sm text-xs text-slate-400 font-mono">
                {Object.entries(item.snapshot).map(([k, v]) => (
                  <div key={k}>
                    {k}: {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                  </div>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
