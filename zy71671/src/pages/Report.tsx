import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  FileCheck,
  Download,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  GitBranch,
  HelpCircle,
  Music2,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { useSetlistStore } from '../store/useSetlistStore';
import { formatDuration, formatDate } from '../lib/utils';
import TraceModal from '../components/TraceModal';

const COLORS = {
  error: '#ef4444',
  warning: '#f59e0b',
  info: '#3b82f6',
  success: '#10b981',
};

export default function Report() {
  const { id } = useParams<{ id: string }>();
  const {
    currentReport,
    loading,
    error,
    generateReport,
    fetchReport,
    exportReport,
    currentSetlist,
    fetchSetlist,
  } = useSetlistStore();
  const [activeTab, setActiveTab] = useState<'overview' | 'validations' | 'conflicts' | 'history'>('overview');
  const [traceModal, setTraceModal] = useState<{
    field: string;
    label: string;
  } | null>(null);

  useEffect(() => {
    if (id) {
      fetchSetlist(id);
      fetchReport(id).catch(() => {
        generateReport(id);
      });
    }
  }, [id, fetchSetlist, fetchReport, generateReport]);

  const handleRefresh = async () => {
    if (!id) return;
    await generateReport(id);
  };

  const handleExport = async (format: 'json' | 'csv') => {
    if (!id) return;
    await exportReport(id, format);
  };

  const openTrace = (field: string, label: string) => {
    setTraceModal({ field, label });
  };

  const pieData = currentReport
    ? [
        { name: '通过', value: currentReport.summary.passed, color: COLORS.success },
        { name: '错误', value: currentReport.summary.errors, color: COLORS.error },
        { name: '警告', value: currentReport.summary.warnings, color: COLORS.warning },
      ]
    : [];

  const barData = currentReport
    ? Object.entries(currentReport.summary.byType || {}).map(([name, value]) => ({
        name:
          {
            key_conflict: '调号错误',
            vocal_range: '音域不匹配',
            instrument: '调弦不兼容',
            duration_over: '时长超限',
            old_version: '旧版混入',
          }[name] || name,
        value,
      }))
    : [];

  if (loading && !currentReport) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!currentReport) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <FileCheck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">暂无检查报告</h3>
          <p className="text-gray-500 mb-6">点击下方按钮生成首次检查报告</p>
          <button
            onClick={handleRefresh}
            className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-500 text-white font-medium rounded-lg hover:bg-indigo-600"
          >
            <RefreshCw className="w-5 h-5" />
            生成检查报告
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <Link
          to={`/setlist/${id}`}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          返回歌单详情
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {currentSetlist?.tourName || '歌单'} - 检查报告
            </h1>
            <p className="text-gray-500 mt-1">
              生成于 {formatDate(currentReport.generatedAt)} · 由 {currentReport.generatedBy} 生成
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              重新检查
            </button>
            <button
              onClick={() => handleExport('json')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 font-medium rounded-lg hover:bg-indigo-100"
            >
              <Download className="w-4 h-4" />
              导出 JSON
            </button>
            <button
              onClick={() => handleExport('csv')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 text-green-600 font-medium rounded-lg hover:bg-green-100"
            >
              <Download className="w-4 h-4" />
              导出 CSV
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-4 gap-4 mb-6">
          <div
            className="bg-gray-50 rounded-lg p-4 cursor-pointer hover:bg-gray-100 transition-colors"
            onClick={() => openTrace('totalDuration', '总演出时长')}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">总时长</span>
              <HelpCircle className="w-4 h-4 text-gray-300" />
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {formatDuration(currentReport.durationBreakdown.total)}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              限制 {formatDuration(currentReport.durationBreakdown.limit)}
            </div>
          </div>

          <div
            className="bg-gray-50 rounded-lg p-4 cursor-pointer hover:bg-gray-100 transition-colors"
            onClick={() => openTrace('songCount', '歌曲数量')}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">歌曲数量</span>
              <HelpCircle className="w-4 h-4 text-gray-300" />
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {currentReport.validations.length}
            </div>
            <div className="text-xs text-gray-500 mt-1">首歌曲参与检查</div>
          </div>

          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center gap-1 mb-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span className="text-sm text-green-700">通过</span>
            </div>
            <div className="text-2xl font-bold text-green-700">
              {currentReport.summary.passed}
            </div>
          </div>

          <div className="bg-red-50 rounded-lg p-4">
            <div className="flex items-center gap-1 mb-2">
              <XCircle className="w-4 h-4 text-red-500" />
              <span className="text-sm text-red-700">问题</span>
            </div>
            <div className="text-2xl font-bold text-red-700">
              {currentReport.summary.errors + currentReport.summary.warnings}
            </div>
          </div>
        </div>

        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6">
          {[
            { key: 'overview', label: '概览' },
            { key: 'validations', label: '校验详情' },
            { key: 'conflicts', label: '冲突提示' },
            { key: 'history', label: '版本历史' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === tab.key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-4">检查结果分布</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, percent }) =>
                        `${name} ${(percent * 100).toFixed(0)}%`
                      }
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-4">问题类型分布</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData}>
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="md:col-span-2 bg-gray-50 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-4">时长分解</h3>
              <div className="space-y-3">
                {currentReport.durationBreakdown.songDurations.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 bg-white rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-sm font-medium">
                        {idx + 1}
                      </span>
                      <div>
                        <div className="font-medium text-gray-900">{item.name}</div>
                        <div className="text-xs text-gray-500">{item.key} 调</div>
                      </div>
                    </div>
                    <div className="text-sm font-semibold text-gray-700">
                      {formatDuration(item.duration)}
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between p-3 bg-indigo-50 rounded-lg">
                  <span className="font-medium text-indigo-700">总时长</span>
                  <span className="text-lg font-bold text-indigo-700">
                    {formatDuration(currentReport.durationBreakdown.total)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'validations' && (
          <div className="space-y-4">
            {currentReport.validations.map((validation, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-lg border ${
                  validation.passed
                    ? 'bg-green-50 border-green-200'
                    : validation.severity === 'error'
                    ? 'bg-red-50 border-red-200'
                    : 'bg-amber-50 border-amber-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  {validation.passed ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5" />
                  ) : validation.severity === 'error' ? (
                    <XCircle className="w-5 h-5 text-red-500 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900">
                        {validation.songName}
                      </span>
                      <span className="text-xs px-2 py-0.5 bg-white/50 rounded-full">
                        {
                          {
                            key_format: '调号格式',
                            vocal_range: '主唱音域',
                            instrument_tuning: '乐器调弦',
                            duration: '时长',
                          }[validation.checkType] || validation.checkType
                        }
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">{validation.message}</p>
                    {validation.suggestion && (
                      <p className="text-sm text-indigo-600 mt-1">
                        💡 {validation.suggestion}
                      </p>
                    )}
                    {validation.details && (
                      <pre className="mt-2 text-xs bg-white/50 p-2 rounded overflow-x-auto">
                        {JSON.stringify(validation.details, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'conflicts' && (
          <div className="space-y-4">
            {currentReport.conflicts.length === 0 ? (
              <div className="p-12 text-center bg-green-50 rounded-lg">
                <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
                <p className="text-green-700 font-medium">未检测到任何冲突</p>
              </div>
            ) : (
              currentReport.conflicts.map((conflict, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-lg border ${
                    conflict.severity === 'error'
                      ? 'bg-red-50 border-red-200'
                      : 'bg-amber-50 border-amber-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {conflict.severity === 'error' ? (
                      <XCircle className="w-5 h-5 text-red-500 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900">
                          {
                            {
                              key_conflict: '调号冲突',
                              vocal_range: '音域不匹配',
                              instrument: '调弦不兼容',
                              duration_over: '时长超限',
                              old_version: '旧版数据混入',
                            }[conflict.type] || conflict.type
                          }
                        </span>
                        {conflict.songName && (
                          <span className="text-sm text-gray-600">
                            歌曲：{conflict.songName}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-700">{conflict.message}</p>
                      {conflict.suggestion && (
                        <p className="text-sm text-indigo-600 mt-1">
                          💡 {conflict.suggestion}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-gray-400" />
              歌单版本历史
            </h3>
            {currentSetlist && (
              <div className="mb-4 p-4 bg-white rounded-lg">
                <p className="text-sm text-gray-600">
                  当前版本：<span className="font-bold text-indigo-600">v{currentSetlist.version}</span>
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  最后更新：{new Date(currentSetlist.lastUpdated).toLocaleString('zh-CN')}
                </p>
              </div>
            )}
            <div className="relative">
              <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gray-200" />
              <div className="space-y-4">
                {[currentReport.generatedAt]
                  .filter(Boolean)
                  .map((timestamp, idx) => (
                    <div key={idx} className="relative pl-8">
                      <div className="absolute left-0 top-1 w-6 h-6 bg-white border-2 border-indigo-500 rounded-full flex items-center justify-center">
                        <div className="w-2 h-2 bg-indigo-500 rounded-full" />
                      </div>
                      <div className="bg-white rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-gray-900">
                            报告生成
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(timestamp).toLocaleString('zh-CN')}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600">
                          检查结果：{currentReport.summary.passed} 通过，
                          {currentReport.summary.errors} 错误，
                          {currentReport.summary.warnings} 警告
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {traceModal && id && (
        <TraceModal
          isOpen={true}
          onClose={() => setTraceModal(null)}
          setlistId={id}
          field={traceModal.field}
          fieldLabel={traceModal.label}
        />
      )}
    </div>
  );
}
