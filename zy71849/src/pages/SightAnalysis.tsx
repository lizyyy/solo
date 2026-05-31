import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAppStore } from '@/store';
import { Eye, Play, CheckCircle2, AlertTriangle, User, Clock, ArrowRight, Link2, Search, RefreshCw } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import TraceSidebar from '@/components/TraceSidebar';
import { TRACE_SOURCE_LABELS } from '@/types';

export default function SightAnalysis() {
  const { id } = useParams();
  const {
    sightRecords,
    loadProjectData,
    runSightAnalysis,
    generateInspection,
    selectRecord,
    selectedRecord,
    batchReuseInfo,
    loading,
  } = useAppStore();

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    if (id) {
      loadProjectData(id);
    }
  }, [id, loadProjectData]);

  const handleRunAnalysis = async () => {
    if (!id) return;
    setIsAnalyzing(true);
    const { isReused } = await runSightAnalysis(id);
    setIsAnalyzing(false);
    setShowSuccess(true);

    if (isReused) {
      setTimeout(() => setShowSuccess(false), 5000);
    } else {
      setTimeout(() => setShowSuccess(false), 3000);
    }
  };

  const handleGenerateInspection = async () => {
    if (!id) return;
    await generateInspection(id);
  };

  const filteredRecords = sightRecords.filter((r) => {
    const matchesSearch =
      r.deviceCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.deviceName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.conclusion.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statuses = ['all', 'confirmed', 'pending', 'manual-modified', 'flip-detected'];

  if (!id) return null;

  return (
    <div className="p-8 relative">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="font-serif text-2xl font-semibold text-slate-800 flex items-center gap-3">
            <Eye className="w-6 h-6 text-green-600" />
            视线分析
          </h1>
          <div className="flex items-center gap-3">
            {batchReuseInfo?.isReused && (
              <span className="badge bg-blue-100 text-blue-700 flex items-center gap-1">
                <RefreshCw className="w-3 h-3" />
                历史记录已复用
              </span>
            )}
            <span className="badge bg-green-100 text-green-700">
              共 {sightRecords.length} 条记录
            </span>
          </div>
        </div>
        <p className="text-sm text-slate-500">运行视线分析计算，查看结果并追溯数据来源</p>
      </div>

      {showSuccess && (
        <div
          className={`mb-6 p-4 rounded-lg flex items-center gap-3 animate-fade-in ${
            batchReuseInfo?.isReused
              ? 'bg-blue-50 border border-blue-200'
              : 'bg-green-50 border border-green-200'
          }`}
        >
          {batchReuseInfo?.isReused ? (
            <>
              <RefreshCw className={`w-5 h-5 text-blue-600 ${isAnalyzing ? 'animate-spin' : ''}`} />
              <div>
                <p className="font-medium text-blue-800">
                  检测到相同批次材料，已复用历史记录
                </p>
                <p className="text-sm text-blue-600">
                  原始分析时间：
                  {batchReuseInfo.originalCreatedAt?.toLocaleString('zh-CN')}，
                  未创建新的成功记录
                </p>
              </div>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <div>
                <p className="font-medium text-green-800">视线分析完成</p>
                <p className="text-sm text-green-600">
                  共处理 {sightRecords.length} 条记录
                </p>
              </div>
            </>
          )}
        </div>
      )}

      <div className="flex gap-4 mb-6">
        <button
          onClick={handleRunAnalysis}
          disabled={isAnalyzing || loading}
          className="btn btn-primary flex items-center gap-2"
        >
          <Play className={`w-4 h-4 ${isAnalyzing ? 'animate-pulse' : ''}`} />
          {isAnalyzing ? '分析中...' : '运行视线分析'}
        </button>

        {sightRecords.length > 0 && (
          <button
            onClick={handleGenerateInspection}
            className="btn btn-secondary flex items-center gap-2"
          >
            <AlertTriangle className="w-4 h-4" />
            生成巡检单
          </button>
        )}

        <div className="relative flex-1 max-w-md ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="搜索设备编号、名称或结论..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input pl-10"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input max-w-40"
        >
          {statuses.map((status) => (
            <option key={status} value={status}>
              {status === 'all' ? '全部状态' : status}
            </option>
          ))}
        </select>
      </div>

      {batchReuseInfo?.isReused && (
        <div className="card border-blue-200 bg-blue-50/30 mb-6">
          <div className="p-4 flex items-start gap-3">
            <RefreshCw className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-medium text-blue-800">幂等性处理生效</h3>
              <p className="text-sm text-blue-700 mt-1">
                系统检测到当前导入的材料与 {batchReuseInfo.originalCreatedAt?.toLocaleDateString('zh-CN')}
                导入的批次内容完全一致，已直接复用历史分析结果，
                <span className="font-medium">未创建新的成功记录</span>。
                这保证了同一批材料反复跑时不会覆盖历史数据。
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>设备编号</th>
                <th>设备名称</th>
                <th>对应点位</th>
                <th>视线值</th>
                <th>结论</th>
                <th>状态</th>
                <th>数据来源</th>
                <th>创建时间</th>
                <th>追溯</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((record) => (
                <tr
                  key={record.id}
                  className={selectedRecord?.id === record.id ? 'bg-primary-50/50' : ''}
                >
                  <td className="font-mono text-sm text-primary-700">{record.deviceCode}</td>
                  <td>{record.deviceName}</td>
                  <td className="text-sm text-slate-600">{record.pointCode}</td>
                  <td>
                    {record.sightValue > 0 ? (
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800">
                          {record.sightValue.toFixed(1)}%
                        </span>
                        <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              record.sightValue >= 90 ? 'bg-status-confirmed' :
                              record.sightValue >= 80 ? 'bg-status-pending' : 'bg-status-manual'
                            }`}
                            style={{ width: `${record.sightValue}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="max-w-xs">
                    <p className="truncate text-sm text-slate-600" title={record.conclusion}>
                      {record.conclusion}
                    </p>
                  </td>
                  <td>
                    <StatusBadge status={record.status} />
                    {record.isManualModified && (
                      <p className="text-xs text-red-600 mt-1">
                        {record.manualModifier} 于 {record.manualModifiedAt?.toLocaleDateString('zh-CN')} 修改
                      </p>
                    )}
                  </td>
                  <td className="text-sm text-slate-600">
                    {TRACE_SOURCE_LABELS[record.traceSource]}
                  </td>
                  <td className="flex items-center gap-1.5 text-sm text-slate-500">
                    <Clock className="w-3.5 h-3.5" />
                    {new Date(record.createdAt).toLocaleDateString('zh-CN')}
                  </td>
                  <td>
                    <button
                      onClick={() => selectRecord(record)}
                      className="p-1.5 hover:bg-primary-50 text-primary-600 rounded-md transition-colors flex items-center gap-1"
                      title="查看追溯链路"
                    >
                      <Link2 className="w-4 h-4" />
                      <span className="text-xs">追溯</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filteredRecords.length === 0 && (
        <div className="text-center py-16">
          {sightRecords.length === 0 ? (
            <>
              <Eye className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 mb-4">暂无分析记录</p>
              <button
                onClick={handleRunAnalysis}
                disabled={isAnalyzing}
                className="btn btn-primary inline-flex items-center gap-2"
              >
                <Play className="w-4 h-4" />
                运行首次分析
              </button>
            </>
          ) : (
            <>
              <Search className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">暂无匹配的分析记录</p>
            </>
          )}
        </div>
      )}

      {selectedRecord && <TraceSidebar />}
    </div>
  );
}
