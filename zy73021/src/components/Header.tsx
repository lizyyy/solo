import { useState } from 'react';
import { PawPrint, Download, RefreshCw, Database, User } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { OPERATORS } from '@/types';
import { generateCsv, downloadCsv, fileTimestamp } from '@/utils/csv';
import { formatDateTime } from '@/utils/format';

export default function Header({ total, filtered }: { total: number; filtered: number }) {
  const [userMenu, setUserMenu] = useState(false);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const currentUser = useAppStore((s) => s.currentUser);
  const setCurrentUser = useAppStore((s) => s.setCurrentUser);
  const exportCsvRows = useAppStore((s) => s.exportCsvRows);
  const resetAll = useAppStore((s) => s.resetAllData);
  const hydrate = useAppStore((s) => s.hydrateFromStorage);

  const handleExportAll = () => {
    const rows = exportCsvRows();
    const maxV = Math.max(...rows.map((r) => r.judgmentVersion), 1);
    const csv = generateCsv(rows, maxV);
    const fname = `宠物减重异常_筛选${rows.length}条_${fileTimestamp()}_v${maxV}.csv`;
    downloadCsv(fname, csv);
    const msg = `✅ 已导出 CSV（${rows.length} 条），与当前页面筛选/判断完全同源，版本签名 v${maxV}`;
    setExportMsg(msg);
    setTimeout(() => setExportMsg(null), 5000);
  };

  return (
    <header className="bg-white/90 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-20">
      <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white shadow-card">
            <PawPrint size={20} />
          </div>
          <div>
            <h1 className="font-serif text-lg font-bold text-slate-800 leading-tight">
              宠物减重异常提醒
              <span className="ml-2 text-[10px] font-sans font-medium text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded align-middle border border-brand-100">
                工作台
              </span>
            </h1>
            <p className="text-[11px] text-slate-500 leading-tight mt-0.5">
              共 {total} 条异常 · 当前筛选显示 {filtered} 条
              <span className="mx-2 text-slate-300">|</span>
              {formatDateTime(new Date().toISOString())}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {exportMsg && (
            <div className="text-xs px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 animate-fade-in">
              {exportMsg}
            </div>
          )}

          <button
            className="btn-secondary"
            title="从本地存储刷新（不重置）"
            onClick={() => hydrate()}
          >
            <RefreshCw size={14} />
            刷新
          </button>

          <button
            className="btn-secondary !text-rose-600 !border-rose-200 hover:!bg-rose-50"
            title="重置为演示数据（清空本地修改）"
            onClick={() => {
              if (confirm('确定重置为初始演示数据吗？您在本地的所有修改会被清除。')) {
                resetAll();
              }
            }}
          >
            <Database size={14} />
            重置演示
          </button>

          <button
            className="btn-primary"
            onClick={handleExportAll}
            title="导出当前筛选结果（与页面完全同源）"
          >
            <Download size={14} />
            导出CSV（{filtered}条）
          </button>

          <div className="relative ml-1">
            <button
              onClick={() => setUserMenu(!userMenu)}
              className="btn-secondary flex items-center gap-2"
            >
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-[10px] font-bold">
                {currentUser.slice(0, 1)}
              </div>
              <span className="text-sm">{currentUser}</span>
              <User size={12} className="text-slate-400" />
            </button>
            {userMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setUserMenu(false)} />
                <div className="absolute right-0 mt-1 z-20 card p-1 w-40 animate-scale-in">
                  <div className="text-[10px] px-3 py-1.5 text-slate-400 uppercase tracking-wide border-b border-slate-100 mb-1">
                    切换身份
                  </div>
                  {OPERATORS.map((op) => (
                    <button
                      key={op}
                      onClick={() => {
                        setCurrentUser(op);
                        setUserMenu(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm rounded-md hover:bg-slate-50 transition flex items-center gap-2 ${
                        op === currentUser ? 'bg-brand-50 text-brand-700' : ''
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${
                          op === currentUser
                            ? 'bg-brand-500'
                            : 'bg-slate-300'
                        }`}
                      >
                        {op.slice(0, 1)}
                      </div>
                      {op}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
