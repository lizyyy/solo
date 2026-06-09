import type { OpinionItem } from '../types';
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '../lib/utils';

interface Props {
  opinions: OpinionItem[];
}

export function OpinionCompare({ opinions }: Props) {
  const missed = opinions.filter((o) => o.isMissed);
  const inBoth = opinions.filter((o) => o.isInDisclosure && o.isOld);
  const onlyDisclosure = opinions.filter((o) => o.isInDisclosure && !o.isOld);
  const onlyOld = opinions.filter((o) => !o.isInDisclosure && !o.isOld);

  const Item = ({ o, variant }: { o: OpinionItem; variant: 'ok' | 'missed' | 'new' }) => (
    <li
      className={cn(
        'p-2.5 text-sm border-l-2 mb-1.5',
        variant === 'ok' && 'border-ink-300 bg-ink-50 text-ink-700',
        variant === 'missed' &&
          'border-fire-500 bg-fire-50 text-fire-800 bg-stripe-red',
        variant === 'new' && 'border-confirm-300 bg-confirm-50 text-confirm-800',
      )}
    >
      <div className="flex items-start gap-2">
        {variant === 'ok' && <CheckCircle2 size={14} className="mt-0.5 text-ink-500 shrink-0" />}
        {variant === 'missed' && (
          <AlertTriangle size={14} className="mt-0.5 text-fire-600 shrink-0" />
        )}
        {variant === 'new' && <CheckCircle2 size={14} className="mt-0.5 text-confirm-600 shrink-0" />}
        <div className="flex-1 leading-relaxed">{o.content}</div>
      </div>
    </li>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h4 className="font-song font-bold text-navy-700 text-sm">
          交底清单 vs 旧意见 比对
        </h4>
        {missed.length > 0 && (
          <span className="tag tag-reject">
            <XCircle size={12} />
            遗漏旧意见 {missed.length} 条
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="card p-3">
          <div className="text-xs font-bold text-navy-600 mb-2 pb-1.5 border-b-2 border-navy-100 flex items-center justify-between">
            <span>本次交底清单</span>
            <span className="font-mono tn">
              {opinions.filter((o) => o.isInDisclosure).length} 条
            </span>
          </div>
          <ul>
            {opinions
              .filter((o) => o.isInDisclosure)
              .map((o) => (
                <Item key={o.id} o={o} variant={o.isMissed ? 'missed' : o.isOld ? 'ok' : 'new'} />
              ))}
          </ul>
        </div>

        <div className="card p-3">
          <div className="text-xs font-bold text-navy-600 mb-2 pb-1.5 border-b-2 border-navy-100 flex items-center justify-between">
            <span>历史旧意见</span>
            <span className="font-mono tn">
              {opinions.filter((o) => o.isOld).length} 条
            </span>
          </div>
          <ul>
            {inBoth.map((o) => (
              <Item key={o.id} o={o} variant="ok" />
            ))}
            {missed.map((o) => (
              <Item key={o.id} o={o} variant="missed" />
            ))}
            {onlyOld.length === 0 && missed.length === 0 && inBoth.length === 0 && (
              <li className="text-xs text-ink-500">暂无历史意见</li>
            )}
          </ul>
        </div>
      </div>

      <div className="text-[11px] text-ink-500 bg-ink-50 p-2 border border-ink-200">
        <b className="text-navy-600">图例：</b>
        <span className="mx-2">🟢 已在本次交底中覆盖</span>
        <span className="mx-2 text-fire-700">🔴 旧意见未在本次交底中出现（遗漏）</span>
        <span className="mx-2 text-confirm-700">🟩 本次新增意见</span>
        <span className="ml-2">{onlyDisclosure.length ? `，新增 ${onlyDisclosure.length} 条` : ''}</span>
      </div>
    </div>
  );
}
