import { useState } from 'react';
import { StoreProvider } from './hooks/useStore';
import ListPage from './pages/ListPage';
import AnalysisPage from './pages/AnalysisPage';
import SupplementPage from './pages/SupplementPage';
import type { TabKey } from './types';

function Shell() {
  const [tab, setTab] = useState<TabKey>('list');
  const [itemId, setItemId] = useState<string | undefined>();

  function go(t: TabKey, id?: string) {
    setTab(t);
    if (id) setItemId(id);
  }

  const tabs: { key: TabKey; label: string; sub: string }[] = [
    { key: 'list', label: '交底清单', sub: '进度·缺口' },
    { key: 'analysis', label: '分析页', sub: '改判影响·变更追踪' },
    { key: 'supplement', label: '补录备注', sub: 'BIM补录·导出变化' }
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-ink">
      {/* 顶栏 */}
      <header className="bg-white border-b border-line sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-4">
          <div>
            <h1 className="text-lg font-semibold text-ink">机电管综交底清单</h1>
            <p className="text-xs text-muted">版本追踪 · 人工改判可追溯 · 月底封账补录留痕</p>
          </div>
          <nav className="ml-auto flex items-center gap-1">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => go(t.key)}
                className={`px-4 py-2 rounded-lg text-sm transition ${
                  tab === t.key
                    ? 'bg-ink text-white'
                    : 'text-muted hover:text-ink hover:bg-slate-100'
                }`}
              >
                <div className="font-medium">{t.label}</div>
                <div className={`text-[10px] ${tab === t.key ? 'text-white/70' : 'text-muted/70'}`}>{t.sub}</div>
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {tab === 'list' && <ListPage onGo={go} />}
        {tab === 'analysis' && <AnalysisPage itemId={itemId} onGo={go} />}
        {tab === 'supplement' && <SupplementPage itemId={itemId} onGo={go} />}
      </main>

      <footer className="max-w-7xl mx-auto px-6 pb-12 text-xs text-muted pt-2">
        交接说明 · 项目经理可按 清单 → 补录 → 分析 的顺序走一遍，覆盖顺利记录 / 补录记录 / 异常记录三种场景。
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
