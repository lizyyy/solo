import Header from '../components/Header';
import StatusTabs from '../components/StatusTabs';
import FilterPanel from '../components/FilterPanel';
import TrackTable from '../components/TrackTable';
import ImportModal from '../components/ImportModal';
import { useTrackStore } from '../store/useTrackStore';
import { Info, Database, FileText, Clock, Shield } from 'lucide-react';

export default function TrackVerificationPage() {
  const records = useTrackStore((state) => state.records);
  const getFilteredRecords = useTrackStore((state) => state.getFilteredRecords);
  const filteredRecords = getFilteredRecords();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <Header />

      <main className="max-w-[1600px] mx-auto px-6 py-8">
        {records.length === 0 && (
          <div className="mb-8">
            <div className="bg-gradient-to-r from-blue-50 to-amber-50 border border-blue-100 rounded-2xl p-6 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Info size={24} className="text-blue-600" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-semibold text-slate-800 mb-2">欢迎使用音乐教师课时核销工具</h2>
                  <p className="text-slate-600 text-sm mb-4">
                    点击右上角"加载样例"可以查看演示数据，或点击"导入Excel"上传您的曲目数据。
                    系统会自动识别授权过期、时码错位、重复曲目等问题，并支持备注编辑和Excel导出。
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Database size={16} className="text-emerald-500" />
                      <span>智能识别中英文表头</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <FileText size={16} className="text-amber-500" />
                      <span>备注历史可追溯</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Shield size={16} className="text-blue-500" />
                      <span>数据本地存储不丢失</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {records.length > 0 && (
          <div className="mb-6">
            <StatusTabs />
            <FilterPanel />
            <TrackTable />
          </div>
        )}

        {filteredRecords.length > 0 && (
          <div className="mt-6 p-4 bg-white/50 rounded-xl border border-slate-200">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Clock size={12} />
              <span>提示：所有数据自动保存在浏览器本地，刷新页面不会丢失。导出的Excel将包含当前筛选条件下的所有 {filteredRecords.length} 条记录。</span>
            </div>
          </div>
        )}
      </main>

      <ImportModal />

      <footer className="max-w-[1600px] mx-auto px-6 py-4 border-t border-slate-200 mt-8">
        <p className="text-center text-xs text-slate-400">
          音乐教师课时核销系统 · 数据本地存储 · 请定期备份重要数据
        </p>
      </footer>
    </div>
  );
}
