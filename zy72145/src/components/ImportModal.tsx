import { useTrackStore } from '../store/useTrackStore';
import { X, CheckCircle, AlertTriangle, XCircle, FileWarning, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import StatusBadge from './StatusBadge';

export default function ImportModal() {
  const importStats = useTrackStore((state) => state.importStats);
  const showImportModal = useTrackStore((state) => state.showImportModal);
  const setShowImportModal = useTrackStore((state) => state.setShowImportModal);
  const [showDirtyRecords, setShowDirtyRecords] = useState(false);

  if (!showImportModal || !importStats) return null;

  const handleClose = () => {
    setShowImportModal(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-hidden animate-slideUp">
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">导入结果</h3>
            <button
              onClick={handleClose}
              className="p-1 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(80vh-64px)]">
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-slate-50 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-slate-900 mb-1">{importStats.total}</div>
              <div className="text-sm text-slate-600">总记录数</div>
            </div>
            <div className="bg-emerald-50 rounded-xl p-4 text-center">
              <div className="flex items-center justify-center gap-2">
                <CheckCircle className="text-emerald-500" size={24} />
                <span className="text-3xl font-bold text-emerald-700">{importStats.success}</span>
              </div>
              <div className="text-sm text-emerald-600">正常</div>
            </div>
            <div className="bg-amber-50 rounded-xl p-4 text-center">
              <div className="flex items-center justify-center gap-2">
                <AlertTriangle className="text-amber-500" size={24} />
                <span className="text-3xl font-bold text-amber-700">{importStats.warnings}</span>
              </div>
              <div className="text-sm text-amber-600">警告</div>
            </div>
            <div className="bg-rose-50 rounded-xl p-4 text-center">
              <div className="flex items-center justify-center gap-2">
                <XCircle className="text-rose-500" size={24} />
                <span className="text-3xl font-bold text-rose-700">{importStats.errors}</span>
              </div>
              <div className="text-sm text-rose-600">错误</div>
            </div>
          </div>

          {importStats.dirtyRecords.length > 0 && (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <button
                onClick={() => setShowDirtyRecords(!showDirtyRecords)}
                className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <FileWarning size={16} className="text-slate-600" />
                  <span className="font-medium text-slate-700">
                    脏数据详情 ({importStats.dirtyRecords.length} 条)
                  </span>
                </div>
                {showDirtyRecords ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {showDirtyRecords && (
                <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
                  {importStats.dirtyRecords.map((record, idx) => (
                    <div key={record.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs text-slate-400">#{idx + 1}</span>
                            <StatusBadge status={record.validationStatus} showIcon size="sm" />
                          </div>
                          <p className="text-sm font-medium text-slate-800 truncate">
                            {record.teacherName || '(教师姓名为空)'} - {record.trackName || '(曲目名称为空)'}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            来源: {record.sourceFile}
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 space-y-1">
                        {record.validationErrors.map((error, eIdx) => (
                          <div key={eIdx} className="text-xs text-rose-600 bg-rose-50 px-2 py-1 rounded">
                            {error.message}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <button
              onClick={handleClose}
              className="px-5 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors font-medium"
            >
              确定
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
