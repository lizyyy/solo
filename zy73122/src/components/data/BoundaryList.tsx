import { GitBranch, MapPin, FileText } from 'lucide-react';
import { useRecordStore } from '../../store/useRecordStore';
import { useBoundaryRecords } from '../../hooks/useRecordQueries';
import { useNavigate } from 'react-router-dom';

export default function BoundaryList() {
  const boundaryRecords = useBoundaryRecords();
  const updateRecord = useRecordStore(s => s.updateRecord);
  const navigate = useNavigate();

  const handleRemoveBoundary = (id: string) => {
    updateRecord(id, { isBoundary: false, status: 'reviewed' });
  };

  return (
    <div className="space-y-4">
      <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
        <div className="flex items-start gap-3">
          <GitBranch className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-purple-800">边界样本管理</p>
            <p className="text-xs text-purple-600 mt-1">
              边界样本从备注中单独提取管理，不再散落在备注里。
              共 <span className="font-semibold">{boundaryRecords.length}</span> 条边界样本
            </p>
          </div>
        </div>
      </div>

      {boundaryRecords.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <GitBranch className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">暂无边界样本</p>
        </div>
      ) : (
        <div className="space-y-3">
          {boundaryRecords.map(record => (
            <div
              key={record.id}
              className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                    <GitBranch className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-slate-800">{record.buoyId}</h4>
                      <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">
                        边界样本
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {new Date(record.recordTime).toLocaleString('zh-CN')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/annotation')}
                  className="text-xs px-2.5 py-1.5 border border-slate-300 text-slate-600 rounded-md hover:bg-slate-50 transition-colors"
                >
                  查看
                </button>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-3">
                <div className="bg-slate-50 rounded-lg p-2.5">
                  <p className="text-xs text-slate-500">海况等级</p>
                  <p className="text-sm font-semibold text-slate-700 mt-0.5">{record.seaState} 级</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-2.5">
                  <p className="text-xs text-slate-500">波高</p>
                  <p className="text-sm font-semibold text-slate-700 mt-0.5">{record.waveHeight} m</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-2.5">
                  <p className="text-xs text-slate-500">风速</p>
                  <p className="text-sm font-semibold text-slate-700 mt-0.5">{record.windSpeed} m/s</p>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2 text-xs">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-500 font-mono">
                  {record.rawLogEntry.latRaw}, {record.rawLogEntry.lonRaw}
                </span>
                <span className="text-slate-300">|</span>
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-500">{record.rawLogEntry.logPage}</span>
              </div>

              {record.rawLogEntry.notes && (
                <div className="mt-3 bg-yellow-50 rounded-lg p-2.5 border border-yellow-200">
                  <p className="text-xs text-yellow-700 font-medium mb-0.5">原备注内容</p>
                  <p className="text-xs text-yellow-800">{record.rawLogEntry.notes}</p>
                </div>
              )}

              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => handleRemoveBoundary(record.id)}
                  className="text-xs px-3 py-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
                >
                  移出边界样本
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
