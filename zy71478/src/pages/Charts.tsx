import { useEffect, useState, useMemo } from 'react';
import { useAppStore } from '../store/appStore';
import { Line, Bar, Scatter } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { BarChart3, Filter, Download, Thermometer, TrendingUp, AlertTriangle } from 'lucide-react';
import { downloadCSV, downloadJSON, createExportPayload, generateFilterDescription } from '../utils/export';
import { formatVelocity, formatTemperature, formatPercent, formatDateTime } from '../utils/format';
import { ViewState } from '../types';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function Charts() {
  const { records, viewState, setViewState, loadAllRecords, filterRecords } = useAppStore();
  const [activeTab, setActiveTab] = useState<'line' | 'bar' | 'scatter'>('line');
  const [showFilters, setShowFilters] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAllRecords().finally(() => setIsLoading(false));
  }, [loadAllRecords]);

  const handleFilterChange = async (filters: Partial<ViewState['filters']>) => {
    setViewState({ filters: { ...viewState.filters, ...filters } });
    await filterRecords({ ...viewState.filters, ...filters });
  };

  const visibleRecords = useMemo(() => {
    const { filters } = viewState;
    return records.filter(r => {
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
  }, [records, viewState.filters]);

  const chartData = useMemo(() => {
    const sorted = [...visibleRecords].sort((a, b) => {
      const tempA = a.input.temperature ?? 0;
      const tempB = b.input.temperature ?? 0;
      return tempA - tempB;
    });

    const labels = sorted.map(r => 
      r.input.temperature !== null ? `${r.input.temperature.toFixed(1)}℃` : 'N/A'
    );

    return {
      line: {
        labels,
        datasets: [
          {
            label: '理论声速 (m/s)',
            data: sorted.map(r => r.result.theoreticalValue),
            borderColor: '#f97316',
            backgroundColor: 'rgba(249, 115, 22, 0.1)',
            tension: 0.4,
            fill: true,
          },
          {
            label: '校准后声速 (m/s)',
            data: sorted.map(r => Number.isNaN(r.result.calibratedValue) ? null : r.result.calibratedValue),
            borderColor: '#06b6d4',
            backgroundColor: 'rgba(6, 182, 212, 0.1)',
            tension: 0.4,
            fill: true,
          },
        ],
      },
      bar: {
        labels,
        datasets: [
          {
            label: '偏差百分比 (%)',
            data: sorted.map(r => Number.isNaN(r.result.deviationPercent) ? 0 : r.result.deviationPercent),
            backgroundColor: sorted.map(r => 
              Math.abs(r.result.deviationPercent) <= 5 ? 'rgba(16, 185, 129, 0.7)' : 'rgba(239, 68, 68, 0.7)'
            ),
            borderColor: sorted.map(r => 
              Math.abs(r.result.deviationPercent) <= 5 ? '#10b981' : '#ef4444'
            ),
            borderWidth: 1,
          },
        ],
      },
      scatter: {
        datasets: [
          {
            label: '实验数据点',
            data: sorted
              .filter(r => r.input.temperature !== null && !Number.isNaN(r.result.calibratedValue))
              .map(r => ({
                x: r.input.temperature!,
                y: r.result.calibratedValue,
                recordId: r.id,
              })),
            backgroundColor: '#3b82f6',
            borderColor: '#1d4ed8',
            borderWidth: 1,
            pointRadius: 6,
            pointHoverRadius: 8,
          },
        ],
      },
    };
  }, [visibleRecords]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: '#94a3b8',
        },
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        titleColor: '#f1f5f9',
        bodyColor: '#cbd5e1',
        borderColor: '#334155',
        borderWidth: 1,
        padding: 12,
        callbacks: {
          label: (context: any) => {
            const value = context.parsed.y ?? context.parsed;
            return `${context.dataset.label}: ${value.toFixed(2)}`;
          },
        },
      },
    },
    scales: {
      x: {
        ticks: { color: '#64748b' },
        grid: { color: 'rgba(148, 163, 184, 0.1)' },
      },
      y: {
        ticks: { color: '#64748b' },
        grid: { color: 'rgba(148, 163, 184, 0.1)' },
      },
    },
  };

  const handleExportCSV = () => {
    downloadCSV(visibleRecords, viewState);
  };

  const handleExportJSON = async () => {
    const payload = await createExportPayload(visibleRecords, viewState);
    downloadJSON(payload);
  };

  const filterDesc = generateFilterDescription(viewState);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-slate-400">加载数据中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">数据筛选与图表</h1>
            <p className="text-slate-400">查看历史实验数据的趋势分析和统计对比</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm text-slate-400 bg-slate-800/50 px-3 py-1.5 rounded-lg">
              当前筛选: {filterDesc}
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${
                showFilters ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              <Filter className="w-4 h-4" />
              筛选
            </button>
            <button
              onClick={handleExportCSV}
              disabled={visibleRecords.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-all"
            >
              <Download className="w-4 h-4" />
              导出CSV
            </button>
            <button
              onClick={handleExportJSON}
              disabled={visibleRecords.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-all"
            >
              <Download className="w-4 h-4" />
              导出JSON
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="mb-6 p-6 bg-slate-800/50 rounded-2xl border border-slate-700">
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
                筛选结果: <span className="text-white font-mono">{visibleRecords.length}</span> 条记录
              </p>
              <button
                onClick={() => {
                  setViewState({
                    filters: {
                      temperatureRange: [-50, 100],
                      dateRange: [new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), new Date()],
                      deviceIds: [],
                      conclusionTypes: [],
                    }
                  });
                  loadAllRecords();
                }}
                className="text-sm text-blue-400 hover:text-blue-300"
              >
                重置筛选
              </button>
            </div>
          </div>
        )}

        <div className="mb-4">
          <div className="flex gap-2">
            {[
              { id: 'line', label: '温度-声速曲线', icon: TrendingUp },
              { id: 'bar', label: '偏差分布', icon: BarChart3 },
              { id: 'scatter', label: '散点对比', icon: Thermometer },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                    : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
          {visibleRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <AlertTriangle className="w-16 h-16 mb-4 opacity-30" />
              <p className="text-lg">暂无数据</p>
              <p className="text-sm mt-2 opacity-60">请先保存实验记录或调整筛选条件</p>
            </div>
          ) : (
            <div className="h-96">
              {activeTab === 'line' && <Line data={chartData.line} options={chartOptions as any} />}
              {activeTab === 'bar' && <Bar data={chartData.bar} options={chartOptions as any} />}
              {activeTab === 'scatter' && <Scatter data={chartData.scatter} options={chartOptions as any} />}
            </div>
          )}
        </div>

        <div className="mt-6 bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
          <h3 className="text-lg font-bold text-white mb-4">数据列表 ({visibleRecords.length} 条)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 border-b border-slate-700">
                  <th className="text-left py-3 px-4">温度</th>
                  <th className="text-left py-3 px-4">理论值</th>
                  <th className="text-left py-3 px-4">测量值</th>
                  <th className="text-left py-3 px-4">校准值</th>
                  <th className="text-left py-3 px-4">偏差</th>
                  <th className="text-left py-3 px-4">结论</th>
                  <th className="text-left py-3 px-4">时间</th>
                </tr>
              </thead>
              <tbody>
                {visibleRecords.slice(0, 10).map((record) => (
                  <tr key={record.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                    <td className="py-3 px-4">
                      {record.input.temperature !== null 
                        ? formatTemperature(record.input.temperature) 
                        : <span className="text-amber-400">缺失</span>
                      }
                    </td>
                    <td className="py-3 px-4 font-mono text-orange-400">
                      {formatVelocity(record.result.theoreticalValue)}
                    </td>
                    <td className="py-3 px-4 font-mono text-cyan-400">
                      {Number.isNaN(record.result.measuredValue) 
                        ? <span className="text-red-400">--</span> 
                        : formatVelocity(record.result.measuredValue)
                      }
                    </td>
                    <td className="py-3 px-4 font-mono text-emerald-400">
                      {Number.isNaN(record.result.calibratedValue) 
                        ? <span className="text-red-400">--</span> 
                        : formatVelocity(record.result.calibratedValue)
                      }
                    </td>
                    <td className="py-3 px-4">
                      <span className={`font-mono ${
                        Math.abs(record.result.deviationPercent) <= 5 ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {formatPercent(record.result.deviationPercent)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        record.result.conclusion === 'consistent' 
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : record.result.conclusion === 'inconsistent'
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-amber-500/20 text-amber-400'
                      }`}>
                        {record.result.conclusion === 'consistent' 
                          ? '一致' 
                          : record.result.conclusion === 'inconsistent' 
                            ? '不一致' 
                            : '警告'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-xs">
                      {formatDateTime(record.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {visibleRecords.length > 10 && (
            <div className="mt-4 text-center text-sm text-slate-500">
              仅显示前10条，共 {visibleRecords.length} 条记录
            </div>
          )}
        </div>

        <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
          <p className="text-sm text-blue-300">
            <strong>视图-导出一致性保证:</strong> 导出的CSV/JSON文件与当前屏幕显示的数据范围完全一致，
            包含筛选条件、排序方式等视图状态快照，便于后续追溯。
          </p>
        </div>
      </div>
    </div>
  );
}
