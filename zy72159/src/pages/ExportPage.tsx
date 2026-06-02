import { useState, useEffect } from 'react';
import { Download, FileSpreadsheet, FileJson, CheckCircle, AlertTriangle, MapPin, RefreshCw, FileText } from 'lucide-react';
import { api } from '../utils/api';
import { useAppStore } from '../store/useAppStore';
import { StatusBadge } from '../components/StatusBadge';
import { SourceTimeline } from '../components/SourceTimeline';
import type { ExportData, ExportRecord, RecordStatus } from '@shared/types';

const TABS: { key: keyof Omit<ExportData, 'exportTime' | 'operator'>; label: string; icon: typeof CheckCircle; color: string }[] = [
  { key: 'processed', label: '已处理', icon: CheckCircle, color: 'text-green-600 bg-green-50 border-green-200' },
  { key: 'verify', label: '待核实', icon: AlertTriangle, color: 'text-orange-600 bg-orange-50 border-orange-200' },
  { key: 'onsite', label: '需要现场复看', icon: MapPin, color: 'text-red-600 bg-red-50 border-red-200' },
];

export default function ExportPage() {
  const { fetchStats, stats } = useAppStore();
  const [exportData, setExportData] = useState<ExportData | null>(null);
  const [activeTab, setActiveTab] = useState<keyof Omit<ExportData, 'exportTime' | 'operator'>>('processed');
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await api.export.preview();
      setExportData(data);
      await fetchStats();
    } catch (e) {
      console.error('Failed to load export data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const downloadFile = async (format: 'csv' | 'json') => {
    setDownloading(format);
    try {
      const result = await (format === 'csv' ? api.export.downloadCSV() : api.export.downloadJSON());
      const blob = new Blob([result.content], {
        type: format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      alert(`导出成功！文件已保存为 ${result.filename}`);
    } catch (e) {
      alert(e instanceof Error ? e.message : '导出失败');
    } finally {
      setDownloading(null);
    }
  };

  const currentRecords = exportData ? exportData[activeTab] : [];
  const activeTabConfig = TABS.find(t => t.key === activeTab)!;

  const StatusTab = ({ status }: { status: 'processed' | 'verify' | 'onsite' }) => {
    const Icon = status === 'processed' ? CheckCircle : status === 'verify' ? AlertTriangle : MapPin;
    const count = stats ? (stats[status] as number) : 0;
    const isActive = activeTab === status;
    const tabConfig = TABS.find(t => t.key === status)!;

    return (
      <button
        onClick={() => setActiveTab(status)}
        className={`flex-1 py-4 px-6 border-2 rounded-xl flex items-center justify-center gap-3 transition-all ${
          isActive
            ? `${tabConfig.color} shadow-lg scale-[1.02]`
            : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-600'
        }`}
      >
        <Icon className={`w-5 h-5 ${isActive ? '' : 'text-gray-400'}`} />
        <div className="text-left">
          <div className="font-semibold">{tabConfig.label}</div>
          <div className="text-xs opacity-75">{count} 条记录</div>
        </div>
      </button>
    );
  };

  return (
    <div className="p-8 animate-fade-in">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="font-serif text-3xl font-bold text-primary-900 mb-2">
            导出公示清单
          </h1>
          <p className="text-gray-600">
            按"已处理/待核实/需要现场复看"三类分类导出，每条记录都包含疏导原因、来源追溯和处理时间，可直接用于社区公示或工程师交接。
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <StatusTab status="processed" />
          <StatusTab status="verify" />
          <StatusTab status="onsite" />
        </div>

        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-4">
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${activeTabConfig.color}`}>
              <activeTabConfig.icon className="w-4 h-4" />
              <span className="font-medium">{activeTabConfig.label}清单</span>
            </div>
            <span className="text-sm text-gray-500">
              共 {currentRecords.length} 条记录
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              disabled={loading}
              className="btn-outline text-sm py-1 flex items-center gap-1"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </button>
            <button
              onClick={() => downloadFile('csv')}
              disabled={downloading !== null}
              className="btn-accent flex items-center gap-2"
            >
              <FileSpreadsheet className="w-4 h-4" />
              {downloading === 'csv' ? '导出中...' : '导出 CSV'}
            </button>
            <button
              onClick={() => downloadFile('json')}
              disabled={downloading !== null}
              className="btn-primary flex items-center gap-2"
            >
              <FileJson className="w-4 h-4" />
              {downloading === 'json' ? '导出中...' : '导出 JSON'}
            </button>
          </div>
        </div>

        {exportData && (
          <div className="bg-gradient-to-r from-primary-50 to-accent-50 rounded-xl p-4 mb-6 border border-primary-100">
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-accent-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-primary-900">导出信息</p>
                <p className="text-gray-600">
                  导出时间：{new Date(exportData.exportTime).toLocaleString('zh-CN')} ·
                  操作人：{exportData.operator} ·
                  总计 {exportData.processed.length + exportData.verify.length + exportData.onsite.length} 条记录
                  （已处理 {exportData.processed.length}、待核实 {exportData.verify.length}、需复看 {exportData.onsite.length}）
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="card overflow-hidden">
          {loading ? (
            <div className="text-center py-16 text-gray-500">
              <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin text-gray-400" />
              加载中...
            </div>
          ) : currentRecords.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <activeTabConfig.icon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>暂无{activeTabConfig.label}的记录</p>
              <p className="text-sm mt-1">请先完成复核工作</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {currentRecords.map((record, idx) => (
                <div
                  key={record.id}
                  className="animate-slide-up"
                  style={{ animationDelay: `${idx * 30}ms` }}
                >
                  <div
                    onClick={() => setExpandedId(expandedId === record.id ? null : record.id)}
                    className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <div className={`w-1 h-12 rounded-full ${
                          activeTab === 'processed' ? 'bg-green-500' :
                          activeTab === 'verify' ? 'bg-orange-500' : 'bg-red-500'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="font-semibold text-primary-900 text-lg">
                              {record.stationName} {record.exitNo}
                            </span>
                            <StatusBadge status={record.status} />
                            {record.isOldCaliber && (
                              <span className="text-xs text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full">
                                📜 旧口径补入
                              </span>
                            )}
                            {record.mergedFrom.length > 0 && (
                              <span className="text-xs text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
                                🔗 合并自{record.mergedFrom.length}条
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-6 mt-1 text-sm text-gray-600">
                            <span>时段：{record.timeSlot}</span>
                            <span className="font-mono">
                              停放 {record.bikeCount} / 容量 {record.capacity} 辆
                            </span>
                            {record.reviewTime && (
                              <span className="text-accent-600">
                                复核于 {new Date(record.reviewTime).toLocaleString('zh-CN')}
                              </span>
                            )}
                          </div>
                          <div className="mt-2 text-sm text-gray-700">
                            <span className="text-gray-500">疏导原因：</span>
                            {record.reason}
                          </div>
                          {record.notes && (
                            <div className="mt-1 text-sm text-gray-600 bg-gray-50 px-3 py-1.5 rounded-lg inline-block">
                              <span className="text-gray-500">处理备注：</span>
                              {record.notes}
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-gray-400 mb-1">点击展开详情</div>
                          <div className="text-xs text-gray-500 font-mono">{record.id.slice(0, 8)}...</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {expandedId === record.id && (
                    <div className="px-6 pb-6 animate-fade-in">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-gray-50 rounded-xl p-6">
                        <div className="space-y-4">
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-2">疏导原因说明（导出时携带）</h4>
                            <div className="bg-white p-4 rounded-lg border border-gray-200">
                              <p className="text-gray-700">{record.reason}</p>
                              {record.conflictSummary !== '无异常' && (
                                <div className="mt-3 pt-3 border-t border-gray-200">
                                  <p className="text-sm font-medium text-orange-700 mb-1">异常说明</p>
                                  <p className="text-sm text-orange-800">{record.conflictSummary}</p>
                                </div>
                              )}
                            </div>
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-2">坐标信息</h4>
                            <div className="bg-white p-4 rounded-lg border border-gray-200 font-mono text-sm">
                              纬度：{record.lat.toFixed(6)}<br />
                              经度：{record.lng.toFixed(6)}
                            </div>
                          </div>
                        </div>
                        <div className="space-y-4">
                          <SourceTimeline sources={record.sources} />
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-2">来源追溯（导出时携带）</h4>
                            <div className="bg-white p-4 rounded-lg border border-gray-200 text-sm text-gray-700">
                              {record.sourceSummary}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-8 card p-6 bg-gradient-to-br from-primary-900 to-primary-800 text-white">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-serif text-xl font-bold mb-2">导出内容说明</h3>
              <p className="text-primary-200 text-sm max-w-2xl">
                导出的 CSV/JSON 文件包含完整的公示信息，每条记录都带有：分类标记、状态说明、疏导原因、
                原始来源追溯（材料名称、日期、导入时间）、异常说明、处理备注和复核时间。
                文件名自动带有日期后缀，可直接用于社区公示或与交通工程师何工交接。
              </p>
            </div>
            <div className="flex gap-2 ml-6">
              <Download className="w-8 h-8 text-accent-400" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
