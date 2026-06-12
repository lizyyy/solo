import { useState } from 'react';
import { useTrackStore } from '../store/useTrackStore';
import { exportToExcel } from '../utils/excelParser';
import { generateSampleRecords } from '../data/sampleData';
import { TrackRecord, STATUS_LABELS } from '../types';
import { Music, Upload, Download, Database, Trash2, FileSpreadsheet } from 'lucide-react';
import FileUpload from './FileUpload';

export default function Header() {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const records = useTrackStore((state) => state.records);
  const filters = useTrackStore((state) => state.filters);
  const addRecords = useTrackStore((state) => state.addRecords);
  const clearAll = useTrackStore((state) => state.clearAll);
  const getFilteredRecords = useTrackStore((state) => state.getFilteredRecords);
  const getStats = useTrackStore((state) => state.getStats);

  const stats = getStats();

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleLoadSample = () => {
    const sampleRecords = generateSampleRecords();
    addRecords(sampleRecords);
    showToast(`已加载 ${sampleRecords.length} 条样例数据`);
  };

  const handleExport = () => {
    const filteredRecords = getFilteredRecords();
    if (filteredRecords.length === 0) {
      showToast('没有可导出的数据', 'error');
      return;
    }

    const sourceFiles = Array.from(new Set(filteredRecords.map((r) => r.sourceFile).filter(Boolean)));
    const exportedAt = Date.now();
    const today = new Date(exportedAt).toISOString().split('T')[0];
    const timestamp = new Date(exportedAt)
      .toTimeString()
      .slice(0, 5)
      .replace(':', '');
    const filename = `音乐教师课时核销_${today}_${timestamp}.xlsx`;

    const filterStatusText = STATUS_LABELS[filters.status];
    exportToExcel(filteredRecords, filename, {
      filters,
      exportedAt,
      totalRecordsCount: records.length,
      filteredRecordsCount: filteredRecords.length,
      sourceFiles,
    });

    const details: string[] = [];
    details.push(`共 ${filteredRecords.length} 条`);
    details.push(`状态: ${filterStatusText}`);
    if (filters.teacherName) details.push(`教师: ${filters.teacherName}`);
    if (filters.trackName) details.push(`曲目: ${filters.trackName}`);
    showToast(`已导出：${details.join('，')}`, 'success');
  };

  const handleClear = () => {
    if (records.length === 0) return;
    if (window.confirm(`确定要清空所有 ${records.length} 条记录吗？此操作不可撤销。`)) {
      clearAll();
      showToast('已清空所有数据');
    }
  };

  const handleUploadSuccess = (records: TrackRecord[]) => {
    setShowUploadModal(false);
    showToast(`成功导入 ${records.length} 条记录`);
  };

  const handleUploadError = (error: string) => {
    showToast(error, 'error');
  };

  return (
    <>
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-lg shadow-lg text-white font-medium animate-slideInRight ${
            toast.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'
          }`}
        >
          {toast.message}
        </div>
      )}

      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-slideUp">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <FileSpreadsheet size={20} />
                导入Excel文件
              </h3>
              <button
                onClick={() => setShowUploadModal(false)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-500"
              >
                ✕
              </button>
            </div>
            <FileUpload onSuccess={handleUploadSuccess} onError={handleUploadError} />
            <div className="mt-4 p-3 bg-slate-50 rounded-lg">
              <p className="text-xs text-slate-600 font-medium mb-1">支持的Excel列名（自动识别中英文）：</p>
              <p className="text-xs text-slate-500">
                教师姓名、曲目名称、授权开始日期、授权结束日期、开始时码、结束时码、课时、备注
              </p>
            </div>
          </div>
        </div>
      )}

      <header className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white shadow-lg">
        <div className="max-w-[1600px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg">
                <Music size={28} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-wide" style={{ fontFamily: '"Noto Serif SC", serif' }}>
                  音乐教师课时核销
                </h1>
                <p className="text-slate-400 text-sm">Music Teacher Track Verification System</p>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="hidden md:flex items-center gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-amber-400">{stats.all}</div>
                  <div className="text-xs text-slate-400">总记录</div>
                </div>
                <div className="w-px h-10 bg-slate-700" />
                <div className="text-center">
                  <div className="text-2xl font-bold text-emerald-400">{stats.normal}</div>
                  <div className="text-xs text-slate-400">正常</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-amber-400">{stats.auth_expired}</div>
                  <div className="text-xs text-slate-400">过期</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-rose-400">{stats.tc_mismatch + stats.dirty_data}</div>
                  <div className="text-xs text-slate-400">错误</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleLoadSample}
                  className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition-colors"
                >
                  <Database size={16} />
                  <span className="hidden sm:inline">加载样例</span>
                </button>
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors"
                >
                  <Upload size={16} />
                  <span className="hidden sm:inline">导入Excel</span>
                </button>
                <button
                  onClick={handleExport}
                  disabled={records.length === 0}
                  className="flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
                >
                  <Download size={16} />
                  <span className="hidden sm:inline">导出Excel</span>
                </button>
                {records.length > 0 && (
                  <button
                    onClick={handleClear}
                    className="flex items-center gap-2 px-3 py-2 bg-rose-600/80 hover:bg-rose-600 rounded-lg text-sm font-medium transition-colors"
                    title="清空所有数据"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
