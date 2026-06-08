import type { HistoryEntry } from '@/types';
import { Camera, MessageSquareText, Syringe, User } from 'lucide-react';
import { weightUnitLabel } from '@/utils/dataUtils';

interface Props { entry: HistoryEntry; compact?: boolean; }

export default function SnapshotViewer({ entry, compact }: Props) {
  const s = entry.snapshot;
  const base = compact ? 'text-[11px]' : 'text-xs';

  return (
    <div className="animate-fade-in-up">
      <div className="mb-3 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="font-serif font-bold text-brand-800 text-base">快照详情</span>
          <span className="chip chip-normal">v{entry.version}</span>
        </div>
        <div className={`text-brand-500 ${base}`}>
          {entry.timestamp} · 操作人：{entry.operator}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <div className="rounded-xl border border-brand-100 bg-brand-50/40 p-4">
          <div className="flex items-center gap-1.5 mb-2 text-brand-600 font-semibold text-xs">
            <User className="w-3.5 h-3.5" /> 基本信息
          </div>
          <dl className={`grid grid-cols-2 gap-x-3 gap-y-1 ${base}`}>
            <dt className="text-brand-400">犬只姓名</dt><dd className="font-semibold text-brand-800">{s.dogName || '—'}</dd>
            <dt className="text-brand-400">品种</dt><dd className="font-semibold text-brand-800">{s.breed || '—'}</dd>
            <dt className="text-brand-400">性别</dt><dd className="font-semibold text-brand-800">{s.gender || '—'}</dd>
            <dt className="text-brand-400">年龄</dt><dd className="font-semibold text-brand-800">{s.age || '—'}</dd>
            <dt className="text-brand-400">体重</dt>
            <dd className="font-semibold text-brand-800">
              {s.weight ? `${s.weight} ${weightUnitLabel[s.weightUnit] || s.weightUnit}` : '—'}
            </dd>
            <dt className="text-brand-400">主人</dt>
            <dd className="font-semibold text-brand-800">
              {s.ownerName || '—'}
              {s.ownerPhone && <span className="text-brand-400 ml-1 text-[10px]">{s.ownerPhone}</span>}
            </dd>
          </dl>
        </div>

        <div className="rounded-xl border border-brand-100 bg-gradient-to-br from-cream-50 to-brand-50 p-4">
          <div className="flex items-center gap-1.5 mb-2 text-brand-600 font-semibold text-xs">
            <Camera className="w-3.5 h-3.5" /> 寄养结论
          </div>
          <div className={`font-serif font-bold text-lg ${
            s.conclusion === '疫苗合格 可寄养' ? 'text-emerald-600' :
            s.conclusion === '待审核' ? 'text-anomaly-500' :
            'text-verdict-600'
          }`}>
            {s.conclusion}
          </div>
          <div className={`mt-2 text-brand-500 ${base}`}>
            疫苗：{s.vaccines.length} 针 · 补录：{s.supplements.length} 条
          </div>
        </div>
      </div>

      {/* Vaccines */}
      <div className="rounded-xl border border-brand-100 mb-4 overflow-hidden">
        <div className="px-4 py-2 bg-brand-50 text-xs font-semibold text-brand-700 flex items-center gap-1.5">
          <Syringe className="w-3.5 h-3.5" /> 疫苗记录 ({s.vaccines.length})
        </div>
        {s.vaccines.length === 0 ? (
          <div className={`p-4 italic text-brand-400 ${base}`}>暂无疫苗记录</div>
        ) : (
          <div className="divide-y divide-brand-50">
            {s.vaccines.map((v, i) => (
              <div key={i} className={`p-3 ${v.attachmentArrivedLate ? 'bg-anomaly-50/40' : ''}`}>
                <div className="flex items-start justify-between flex-wrap gap-2 mb-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="chip chip-normal">第 {i + 1} 针</span>
                    <span className="font-semibold text-brand-800 text-sm">{v.name}</span>
                    {v.attachmentArrivedLate && <span className="chip chip-anomaly">晚到附件</span>}
                  </div>
                </div>
                <div className={`grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-0.5 ${base}`}>
                  <div><span className="text-brand-400">接种日：</span>{v.date || '—'}</div>
                  <div><span className="text-brand-400">有效期：</span>{v.expireDate || '—'}</div>
                  <div className="md:col-span-2 truncate"><span className="text-brand-400">附件：</span>{v.attachmentName || '—'}</div>
                </div>
                {v.attachmentNote && (
                  <div className={`mt-1 text-brand-600 bg-cream-50 rounded px-2 py-1 border border-cream-100 ${base}`}>
                    💬 {v.attachmentNote}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Supplements */}
      {s.supplements.length > 0 && (
        <div className="rounded-xl border border-brand-100 overflow-hidden">
          <div className="px-4 py-2 bg-brand-50 text-xs font-semibold text-brand-700 flex items-center gap-1.5">
            <MessageSquareText className="w-3.5 h-3.5" /> 历史补录备注 ({s.supplements.length})
          </div>
          <div className="p-3 space-y-2 max-h-56 overflow-auto scrollbar-thin">
            {s.supplements.map((sp, i) => (
              <div key={i} className="flex gap-2">
                <div className={`flex-shrink-0 w-20 text-[10px] text-brand-400 pt-0.5 text-right font-mono`}>
                  {sp.time.slice(5)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] text-brand-500 mb-0.5">{sp.operator}</div>
                  <div className={`rounded-lg px-3 py-2 border ${
                    sp.operator === '小温' ? 'bg-brand-50 border-brand-100 text-brand-800' : 'bg-cream-100 border-cream-200 text-anomaly-700'
                  } ${base} leading-relaxed whitespace-pre-wrap`}>
                    {sp.content}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
