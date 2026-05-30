import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import { formatVelocity, formatTemperature, formatPercent, formatDateTime, formatRelativeTime } from '../utils/format';
import { downloadCSV, createExportPayload, downloadJSON, generateFilterDescription } from '../utils/export';
import { 
  History as HistoryIcon, 
  Search, 
  Filter, 
  Download, 
  Eye, 
  RotateCcw, 
  Trash2, 
  ArrowUpDown,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Thermometer,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  FileText
} from 'lucide-react';
import { CompleteRecord, ViewState } from '../types';

export default function History() {
  const navigate = useNavigate();
  const { records, loadAllRecords, viewState, setViewState, filterRecords } = useAppStore();
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [sortField, setSortField] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedRecords, setSelectedRecords] = useState<Set<string>>(new Set());
  const [isRecalculating, setIsRecalculating] = useState<string | null>(null);

  useEffect(() => {
    loadAllRecords().finally(() => setIsLoading(false));
  }, [loadAllRecords]);

  const handleFilterChange = async (filters: Partial<ViewState['filters']>) => {
    setViewState({ filters: { ...viewState.filters, ...filters } });
    await filterRecords({ ...viewState.filters, ...filters });
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const toggleSelectAll = () => {
    if (selectedRecords.size === filteredRecords.length) {
      setSelectedRecords(new Set());
    } else {
      setSelectedRecords(new Set(filteredRecords.map(r => r.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedRecords);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedRecords(newSelected);
  };

  const handleViewDetail = (id: string) => {
    navigate(`/result/${id}`);
  };

  const handleRecalculate = async (id: string) => {
    setIsRecalculating(id);
    try {
      await useAppStore.getState().recalculateRecord(id);
    } finally {
      setIsRecalculating(null);
    }
  };

  const handleExportSelectedCSV = () => {
    const selected = records.filter(r => selectedRecords.has(r.id));
    downloadCSV(selected, viewState, `历史记录_${selected.length}条`);
  };

  const handleExportSelectedJSON = async () => {
    const selected = records.filter(r => selectedRecords.has(r.id));
    const payload = await createExportPayload(selected, viewState);
    downloadJSON(payload, `历史记录_${selected.length}条`);
  };

  const handleExportAllCSV = () => {
    downloadCSV(filteredRecords, viewState, '全部历史记录');
  };

  const handleExportAllJSON = async () => {
    const payload = await createExportPayload(filteredRecords, viewState);
    downloadJSON(payload, '全部历史记录');
  };

  const filteredRecords = useMemo(() => {
    const { filters } = viewState;
    let result = [...records];

    result = result.filter(r => {
      const temp = r.input.temperature;
      if (temp !== null && (temp < filters.temperatureRange[0] || temp > filters.temperatureRange[1])) {
        return false;
      }
      if (r.createdAt < filters.dateRange[0].getTime() || r.createdAt > filters.dateRange[1].getTime()) {
        return false;
      }
      if (filters.deviceIds.length > 0 && (!r.input.deviceId || !filters.deviceIds.includes(r.input.deviceId))) {
        return false;
      }
      if (filters.conclusionTypes.length > 0 && !filters.conclusionTypes.includes(r.result.conclusion)) {
        return false;
      }
      return true;
    });

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(r => 
        r.id.toLowerCase().includes(term) ||
        (r.input.deviceId?.toLowerCase().includes(term)) ||
        (r.input.operator?.toLowerCase().includes(term)) ||
        (r.input.notes?.toLowerCase().includes(term))
      );
    }

    result.sort((a, b) => {
      let aVal: any = a.createdAt;
      let bVal: any = b.createdAt;

      switch (sortField) {
        case 'temperature':
          aVal = a.input.temperature ?? -Infinity;
          bVal = b.input.temperature ?? -Infinity;
          break;
        case 'theoreticalValue':
          aVal = a.result.theoreticalValue;
          bVal = b.result.theoreticalValue;
          break;
        case 'measuredValue':
          aVal = a.result.measuredValue;
          bVal = b.result.measuredValue;
          break;
        case 'deviationPercent':
          aVal = Math.abs(a.result.deviationPercent);
          bVal = Math.abs(b.result.deviationPercent);
          break;
        case 'createdAt':
        default:
          aVal = a.createdAt;
          bVal = b.createdAt;
          break;
      }

      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      }
      return aVal < bVal ? 1 : -1;
    });

    return result;
  }, [records, viewState.filters, searchTerm, sortField, sortOrder]);

  const filterDesc = generateFilterDescription(viewState);

  const conclusionConfig = {
    consistent: { icon: CheckCircle2, color: 'text-emerald-400', bgColor: 'bg-emerald-500/20', label: '一致' },
    inconsistent: { icon: XCircle, color: 'text-red-400', bgColor: 'bg-red-500/20', label: '不一致' },
    warning: { icon: AlertTriangle, color: 'text-amber-400', bgColor: 'bg-amber-500/20', label: '警告' },
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-slate-500" />;
    return sortOrder === 'asc' 
      ? <ChevronUp className="w-3 h-3 text-blue-400" />
      : <ChevronDown className="w-3 h-3 text-blue-400" />;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-slate-400">加载历史记录中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
              <HistoryIcon className="w-8 h-8 text-blue-400" />
              历史记录
            </h1>
            <p className="text-slate-400">
              查看和管理所有实验记录，支持筛选、搜索、批量导出
            </p>
          </div>
          <div className="flex items-center gap-3">
            {selectedRecords.size > 0 && (
              <>
                <button
                  onClick={handleExportSelectedCSV}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-all"
                >
                  <Download className="w-4 h-4" />
                  导出选中 ({selectedRecords.size}) CSV
                </button>
                <button
                  onClick={handleExportSelectedJSON}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-all"
                >
                  <Download className="w-4 h-4" />
                  导出选中 JSON
                </button>
              </>
            )}
            <button
              onClick={handleExportAllCSV}
              disabled={filteredRecords.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-all"
            >
              <Download className="w-4 h-4" />
              导出全部 CSV
            </button>
            <button
              onClick={handleExportAllJSON}
              disabled={filteredRecords.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-all"
            >
              <Download className="w-4 h-4" />
              导出全部 JSON
            </button>
          </div>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-4 border border-slate-700 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="搜索记录ID、设备编号、操作人员、备注..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
            <div className="text-sm text-slate-400 bg-slate-900/50 px-3 py-2 rounded-xl">
              当前筛选: {filterDesc}
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all ${
                showFilters ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              <Filter className="w-4 h-4" />
              高级筛选
            </button>
          </div>

          {showFilters && (
            <div className="mt-4 pt-4 border-t border-slate-700">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <label className="text-sm text-slate-300 flex items-center gap-2">
                    <Thermometer className="w-4 h-4 text-orange-400" />
                    温度范围 (℃)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={viewState.filters.temperatureRange[0]}
                      onChange={(e) => handleFilterChange({
                        temperatureRange: [parseFloat(e.target.value) || -50, viewState.filters.temperatureRange[1]]
                      })}
                      className="flex-1 px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm"
                    />
                    <input
                      type="number"
                      value={viewState.filters.temperatureRange[1]}
                      onChange={(e) => handleFilterChange({
                        temperatureRange: [viewState.filters.temperatureRange[0], parseFloat(e.target.value) || 100]
                      })}
                      className="flex-1 px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-slate-300">结论类型</label>
                  <div className="flex gap-2">
                    {['consistent', 'inconsistent', 'warning'].map((type) => (
                      <button
                        key={type}
                        onClick={() => {
                          const current = viewState.filters.conclusionTypes;
                          const next = current.includes(type)
                            ? current.filter(t => t !== type)
                            : [...current, type];
                          handleFilterChange({ conclusionTypes: next });
                        }}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                          viewState.filters.conclusionTypes.includes(type)
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                        }`}
                      >
                        {type === 'consistent' ? '一致' : type === 'inconsistent' ? '不一致' : '警告'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-slate-300">开始日期</label>
                  <input
                    type="date"
                    value={new Date(viewState.filters.dateRange[0]).toISOString().split('T')[0]}
                    onChange={(e) => handleFilterChange({
                      dateRange: [new Date(e.target.value), viewState.filters.dateRange[1]]
                    })}
                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-slate-300">结束日期</label>
                  <input
                    type="date"
                    value={new Date(viewState.filters.dateRange[1]).toISOString().split('T')[0]}
                    onChange={(e) => handleFilterChange({
                      dateRange: [viewState.filters.dateRange[0], new Date(e.target.value)]
                    })}
                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm"
                  />
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-slate-400">
                  筛选结果: <span className="text-white font-mono">{filteredRecords.length}</span> 条记录
                </p>
                <button
                  onClick={async () => {
                    setViewState({
                      filters: {
                        temperatureRange: [-50, 100],
                        dateRange: [new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), new Date()],
                        deviceIds: [],
                        conclusionTypes: [],
                      }
                    });
                    await loadAllRecords();
                    setSearchTerm('');
                  }}
                  className="text-sm text-blue-400 hover:text-blue-300"
                >
                  重置所有筛选
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700 overflow-hidden">
          {filteredRecords.length === 0 ? (
            <div className="p-12 text-center">
              <AlertCircle className="w-16 h-16 mx-auto mb-4 text-slate-600" />
              <h3 className="text-xl font-bold text-white mb-2">暂无记录</h3>
              <p className="text-slate-400 mb-4">
                {records.length === 0 
                  ? '还没有保存任何实验记录' 
                  : '没有符合筛选条件的记录，请调整筛选条件'}
              </p>
              {records.length === 0 && (
                <button
                  onClick={() => navigate('/calculator')}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-all"
                >
                  <FileText className="w-4 h-4" />
                  开始第一次实验
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-900/50">
                  <tr className="text-slate-400 border-b border-slate-700">
                    <th className="text-left py-4 px-4 w-12">
                      <input
                        type="checkbox"
                        checked={selectedRecords.size === filteredRecords.length && filteredRecords.length > 0}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-blue-600 focus:ring-blue-500/50"
                      />
                    </th>
                    <th 
                      className="text-left py-4 px-4 cursor-pointer hover:text-white transition-colors"
                      onClick={() => handleSort('createdAt')}
                    >
                      <div className="flex items-center gap-2">
                        时间
                        <SortIcon field="createdAt" />
                      </div>
                    </th>
                    <th 
                      className="text-left py-4 px-4 cursor-pointer hover:text-white transition-colors"
                      onClick={() => handleSort('temperature')}
                    >
                      <div className="flex items-center gap-2">
                        温度
                        <SortIcon field="temperature" />
                      </div>
                    </th>
                    <th 
                      className="text-left py-4 px-4 cursor-pointer hover:text-white transition-colors"
                      onClick={() => handleSort('theoreticalValue')}
                    >
                      <div className="flex items-center gap-2">
                        理论值
                        <SortIcon field="theoreticalValue" />
                      </div>
                    </th>
                    <th 
                      className="text-left py-4 px-4 cursor-pointer hover:text-white transition-colors"
                      onClick={() => handleSort('measuredValue')}
                    >
                      <div className="flex items-center gap-2">
                        测量值
                        <SortIcon field="measuredValue" />
                      </div>
                    </th>
                    <th 
                      className="text-left py-4 px-4 cursor-pointer hover:text-white transition-colors"
                      onClick={() => handleSort('deviationPercent')}
                    >
                      <div className="flex items-center gap-2">
                        偏差
                        <SortIcon field="deviationPercent" />
                      </div>
                    </th>
                    <th className="text-left py-4 px-4">结论</th>
                    <th className="text-left py-4 px-4">异常</th>
                    <th className="text-left py-4 px-4">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((record: CompleteRecord) => {
                    const config = conclusionConfig[record.result.conclusion];
                    const ConclusionIcon = config.icon;
                    const isSelected = selectedRecords.has(record.id);
                    
                    return (
                      <tr 
                        key={record.id} 
                        className={`border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors ${
                          isSelected ? 'bg-blue-500/5' : ''
                        }`}
                      >
                        <td className="py-4 px-4">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(record.id)}
                            className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-blue-600 focus:ring-blue-500/50"
                          />
                        </td>
                        <td className="py-4 px-4">
                          <div className="text-white">{formatRelativeTime(record.createdAt)}</div>
                          <div className="text-xs text-slate-500">{formatDateTime(record.createdAt)}</div>
                          <div className="text-xs text-slate-600 font-mono mt-1">#{record.id.slice(0, 12)}</div>
                        </td>
                        <td className="py-4 px-4">
                          {record.input.temperature !== null ? (
                            <span className="font-mono text-orange-400">
                              {formatTemperature(record.input.temperature)}
                            </span>
                          ) : (
                            <span className="text-amber-400 text-sm">缺失</span>
                          )}
                        </td>
                        <td className="py-4 px-4 font-mono text-orange-400">
                          {formatVelocity(record.result.theoreticalValue)}
                        </td>
                        <td className="py-4 px-4">
                          {Number.isNaN(record.result.measuredValue) ? (
                            <span className="text-red-400 text-sm">--</span>
                          ) : (
                            <span className="font-mono text-cyan-400">
                              {formatVelocity(record.result.measuredValue)}
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          <span className={`font-mono ${
                            Math.abs(record.result.deviationPercent) <= 5 ? 'text-emerald-400' : 'text-red-400'
                          }`}>
                            {formatPercent(record.result.deviationPercent)}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bgColor} ${config.color}`}>
                            <ConclusionIcon className="w-3 h-3" />
                            {config.label}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          {record.anomalies.length > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-500/20 text-amber-400">
                              <AlertTriangle className="w-3 h-3" />
                              {record.anomalies.length}
                            </span>
                          ) : (
                            <span className="text-slate-500 text-xs">-</span>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleViewDetail(record.id)}
                              className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition-all"
                              title="查看详情"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleRecalculate(record.id)}
                              disabled={isRecalculating === record.id}
                              className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition-all disabled:opacity-50"
                              title="复算验证"
                            >
                              {isRecalculating === record.id ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              ) : (
                                <RotateCcw className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="px-6 py-4 border-t border-slate-700 flex items-center justify-between text-sm text-slate-400">
            <span>
              显示 {filteredRecords.length} 条记录
              {selectedRecords.size > 0 && `，已选择 ${selectedRecords.size} 条`}
            </span>
            <span>
              共 {records.length} 条总记录
            </span>
          </div>
        </div>

        <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
          <p className="text-sm text-blue-300">
            <strong>视图-导出一致性保证:</strong> 导出的CSV/JSON文件与当前屏幕显示的数据范围完全一致，
            包含所有筛选条件、搜索关键词、排序方式等视图状态快照，确保可追溯性。
          </p>
        </div>
      </div>
    </div>
  );
}
