import { Music2, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { FilterBar } from '../components/FilterBar';
import { RecordsTable } from '../components/RecordsTable';
import { useRecordStore } from '../store/useRecordStore';

export default function Home() {
  const navigate = useNavigate();
  const { exportCsv } = useRecordStore();

  const handleExport = () => {
    exportCsv();
  };

  return (
    <div className="min-h-screen bg-warm-50">
      <header className="bg-slate-800 text-white py-8 mb-8 no-print">
        <div className="container max-w-7xl px-4">
          <div className="flex items-center gap-3 mb-2">
            <Music2 size={32} className="text-amber-500" />
            <h1 className="font-display text-3xl font-semibold">编曲工程轨道清理</h1>
          </div>
          <p className="text-slate-300 text-sm max-w-2xl">
            管理舞台通道表中的曲目清理记录，保持数据完整可追溯，减少交接时的重复核对工作
          </p>
          <div className="mt-4 flex gap-3">
            <button
              onClick={() => navigate('/export')}
              className="btn-secondary !bg-white/10 !text-white !border-white/20 hover:!bg-white/20 flex items-center gap-2"
            >
              <Download size={16} />
              导出清单预览
            </button>
          </div>
        </div>
      </header>

      <main className="container max-w-7xl px-4 pb-12">
        <div className="h-1 w-20 bg-amber-500 mb-6 rounded-full animate-fade-in"></div>
        <FilterBar />
        <RecordsTable onExport={handleExport} />
      </main>

      <footer className="border-t border-warm-200 py-6 no-print">
        <div className="container max-w-7xl px-4 text-center text-sm text-slate-500">
          <p>编曲工程轨道清理管理系统 · 厂牌运营专用</p>
        </div>
      </footer>
    </div>
  );
}
