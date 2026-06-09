import { FileText, PackageOpen, Ban, AlertTriangle, Handshake } from 'lucide-react';
import { useReconciliationStore } from '../store/useReconciliationStore';

export function SummaryCard() {
  const { summary } = useReconciliationStore();

  return (
    <div className="relative bg-gradient-to-br from-[#FFF9E6] via-[#FFFDF2] to-[#FFF6DB] rounded-xl border border-[#E87722]/20 shadow-sm overflow-hidden">
      <div className="absolute top-0 right-0 w-40 h-40 bg-[#E87722]/5 rounded-full -translate-y-20 translate-x-20 blur-2xl pointer-events-none" />

      <div className="relative p-5 md:p-6">
        <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-[#E87722]/15">
          <div className="p-2 rounded-lg bg-[#E87722]/10">
            <FileText size={20} className="text-[#E87722]" strokeWidth={2.2} />
          </div>
          <h2 className="text-xl font-bold text-stone-800" style={{ fontFamily: '"ZCOOL XiaoWei", "LXGW WenKai", serif' }}>
            本月对账摘要
          </h2>
        </div>

        <div className="space-y-3 mb-5">
          <p className="text-stone-700 text-[15px] leading-relaxed">
            📊 <span className="font-semibold text-stone-800">{summary.totalText}</span>
          </p>
          <p className="text-stone-700 text-[15px] leading-relaxed">
            ✅ <span className="font-semibold text-stone-800">{summary.doneText}</span>
          </p>
        </div>

        {summary.missingList.length > 0 && (
          <div className="mb-4 p-4 rounded-lg bg-white/70 border border-orange-200/60 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-3">
              <PackageOpen size={17} className="text-[#E87722]" strokeWidth={2.2} />
              <h3 className="font-bold text-[#E87722] text-sm">
                🔔 以下 {summary.missingList.length} 位主人缺材料（交接时优先联系）：
              </h3>
            </div>
            <ul className="space-y-2 ml-6">
              {summary.missingList.map((m, idx) => (
                <li key={idx} className="text-[14px] text-stone-700 list-disc marker:text-[#E87722]">
                  <span className="font-semibold text-stone-800">{m.name}</span>
                  <span className="text-stone-500 mx-1">— 缺少：</span>
                  <span className="text-[#E87722] font-medium">{m.items.join('、')}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {summary.returnedList.length > 0 && (
          <div className="mb-4 p-4 rounded-lg bg-white/70 border border-rose-200/60 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-3">
              <Ban size={17} className="text-[#C1121F]" strokeWidth={2.2} />
              <h3 className="font-bold text-[#C1121F] text-sm">
                ⛔ 以下 {summary.returnedList.length} 条记录已退回：
              </h3>
            </div>
            <ul className="space-y-2 ml-6">
              {summary.returnedList.map((r, idx) => (
                <li key={idx} className="text-[14px] text-stone-700 list-disc marker:text-[#C1121F]">
                  <span className="font-semibold text-stone-800">{r.name}</span>
                  <span className="text-stone-500 mx-1">— 退回原因：</span>
                  <span className="text-[#C1121F] font-medium">{r.reason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {summary.remarkIssueList.length > 0 && (
          <div className="p-4 rounded-lg bg-white/70 border border-amber-200/60 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={17} className="text-amber-600" strokeWidth={2.2} />
              <h3 className="font-bold text-amber-700 text-sm">
                ⚠️ 以下 {summary.remarkIssueList.length} 条备注含有「回访结论」但未有人跟进：
              </h3>
            </div>
            <ul className="space-y-2 ml-6">
              {summary.remarkIssueList.map((r, idx) => (
                <li
                  key={idx}
                  className="text-[14px] text-stone-700 list-disc marker:text-amber-600"
                  title={r.remark}
                >
                  <span className="font-semibold text-stone-800">{r.name}</span>
                  <span className="text-stone-500 mx-1">— 备注摘要：</span>
                  <span className="text-amber-700 font-medium">
                    {r.remark.length > 40 ? r.remark.slice(0, 40) + '…' : r.remark}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {summary.missingList.length === 0 &&
          summary.returnedList.length === 0 &&
          summary.remarkIssueList.length === 0 && (
            <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center gap-2">
              <Handshake size={20} className="text-emerald-600" />
              <span className="text-emerald-800 font-medium">
                太棒了！当前筛选范围内所有记录均已处理完毕，无待补件、无退回、无备注遗漏 🎉
              </span>
            </div>
          )}
      </div>
    </div>
  );
}
