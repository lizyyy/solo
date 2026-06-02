import { useState, useEffect } from 'react';
import { CheckSquare, Filter, ArrowRight, AlertTriangle, CheckCircle, MapPin, History } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { RecordRow } from '../components/RecordRow';
import type { RecordStatus } from '@shared/types';

const FILTER_OPTIONS: { value: RecordStatus | 'all'; label: string; countKey?: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'pending', label: '待处理' },
  { value: 'processed', label: '已处理 ✓' },
  { value: 'verify', label: '待核实 ⚠' },
  { value: 'onsite', label: '需要现场复看 📍' },
];

export default function ReviewPage() {
  const navigate = useNavigate();
  const { records, stats, loading, error, fetchRecords, updateRecordStatus } = useAppStore();
  const [filter, setFilter] = useState<RecordStatus | 'all'>('all');
  const [showOnlyConflicts, setShowOnlyConflicts] = useState(false);
  const [showOnlyOldCaliber, setShowOnlyOldCaliber] = useState(false);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const filteredRecords = records.filter(r => {
    if (filter !== 'all' && r.status !== filter) return false;
    if (showOnlyConflicts && r.conflicts.length === 0) return false;
    if (showOnlyOldCaliber && !r.isOldCaliber) return false;
    return true;
  });

  const sampleRecords = {
    smooth: records.find(r => r.stationName === '龙阳路站' && r.exitNo === '2号口'),
    needConfirm: records.find(r => r.stationName === '世纪大道站' && r.exitNo === '1号口'),
    oldCaliber: records.find(r => r.isOldCaliber),
  };

  return (
    <div className="p-8 animate-fade-in">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="font-serif text-3xl font-bold text-primary-900 mb-2">
            人工复核
          </h1>
          <p className="text-gray-600">
            逐条确认疏导记录，标记状态并添加备注。每条记录都保留完整来源追溯和处理时间。
          </p>
        </div>

        {(sampleRecords.smooth || sampleRecords.needConfirm || sampleRecords.oldCaliber) && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {sampleRecords.smooth && (
              <div className="card p-4 border-l-4 border-green-500 bg-gradient-to-r from-green-50 to-white">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs text-green-700 font-medium mb-1">✓ 样例·顺利记录</div>
                    <div className="font-semibold text-primary-900">
                      {sampleRecords.smooth.stationName} {sampleRecords.smooth.exitNo}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      无冲突，容量正常，来源清晰可追溯
                    </div>
                  </div>
                </div>
              </div>
            )}
            {sampleRecords.needConfirm && (
              <div className="card p-4 border-l-4 border-orange-500 bg-gradient-to-r from-orange-50 to-white">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-6 h-6 text-orange-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs text-orange-700 font-medium mb-1">⚠ 样例·人工确认</div>
                    <div className="font-semibold text-primary-900">
                      {sampleRecords.needConfirm.stationName} {sampleRecords.needConfirm.exitNo}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      同名路口坐标偏移约200米，需人工确认
                    </div>
                  </div>
                </div>
              </div>
            )}
            {sampleRecords.oldCaliber && (
              <div className="card p-4 border-l-4 border-yellow-600 bg-gradient-to-r from-yellow-50 to-white">
                <div className="flex items-start gap-3">
                  <History className="w-6 h-6 text-yellow-700 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs text-yellow-800 font-medium mb-1">📜 样例·旧口径</div>
                    <div className="font-semibold text-primary-900">
                      {sampleRecords.oldCaliber.stationName} {sampleRecords.oldCaliber.exitNo}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      2023年12月会议纪要补入，统计口径不同
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="card p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-600">筛选：</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {FILTER_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setFilter(opt.value)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-all ${
                    filter === opt.value
                      ? 'bg-accent-500 text-white shadow-md'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {opt.label}
                  {stats && opt.value !== 'all' && (
                    <span className="ml-1 opacity-75">
                      ({stats[opt.value as keyof typeof stats] as number})
                    </span>
                  )}
                  {opt.value === 'all' && stats && (
                    <span className="ml-1 opacity-75">({stats.total})</span>
                  )}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showOnlyConflicts}
                  onChange={e => setShowOnlyConflicts(e.target.checked)}
                  className="rounded border-gray-300 text-accent-500 focus:ring-accent-500"
                />
                仅显示异常
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showOnlyOldCaliber}
                  onChange={e => setShowOnlyOldCaliber(e.target.checked)}
                  className="rounded border-gray-300 text-accent-500 focus:ring-accent-500"
                />
                仅显示旧口径
              </label>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 text-red-700">
            {error}
          </div>
        )}

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="table-header w-10"></th>
                  <th className="table-header">站点/出口</th>
                  <th className="table-header">时段</th>
                  <th className="table-header">数量/容量</th>
                  <th className="table-header">疏导原因</th>
                  <th className="table-header">异常标签</th>
                  <th className="table-header">状态</th>
                  <th className="table-header text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-gray-500">
                      <div className="animate-pulse">加载中...</div>
                    </td>
                  </tr>
                ) : filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-gray-500">
                      {records.length === 0 ? (
                        <div>
                          <MapPin className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                          <p>暂无数据</p>
                          <p className="text-sm mt-1">请先导入数据或加载样例数据</p>
                        </div>
                      ) : (
                        <p>没有符合筛选条件的记录</p>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map(record => (
                    <RecordRow
                      key={record.id}
                      record={record}
                      onUpdateStatus={updateRecordStatus}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {filteredRecords.length > 0 && (
          <div className="flex justify-between items-center mt-6">
            <div className="text-sm text-gray-500">
              显示 {filteredRecords.length} / {records.length} 条记录
              {showOnlyConflicts && ' · 仅异常'}
              {showOnlyOldCaliber && ' · 仅旧口径'}
            </div>
            <button
              onClick={() => navigate('/export')}
              className="btn-accent text-lg px-8 py-3 flex items-center gap-2"
            >
              前往导出公示
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
