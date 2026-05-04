import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import {
  FileText,
  Download,
  Calendar,
  AlertTriangle,
  BookOpen,
  TrendingUp,
} from 'lucide-react';
import { reportsApi } from '../services/api';

const typeDescriptions = {
  scale_identification: '音阶音级识别',
  chord_construction: '和弦构成',
  inversion: '转位判断',
  roman_numeral: '罗马数字和弦功能',
  cadence: '终止式判断',
};

function DateRangeSelector({ startDate, endDate, onStartChange, onEndChange }) {
  return (
    <div className="flex flex-wrap items-center gap-4 p-4 bg-white rounded-xl border border-gray-100">
      <div className="flex items-center gap-2">
        <Calendar className="w-5 h-5 text-gray-500" />
        <span className="text-sm font-medium text-gray-700">报告周期:</span>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={startDate}
          onChange={(e) => onStartChange(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <span className="text-gray-400">至</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => onEndChange(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => {
            const today = new Date();
            const weekAgo = new Date(today);
            weekAgo.setDate(weekAgo.getDate() - 7);
            onStartChange(weekAgo.toISOString().split('T')[0]);
            onEndChange(today.toISOString().split('T')[0]);
          }}
          className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
        >
          最近7天
        </button>
        <button
          onClick={() => {
            const today = new Date();
            const monthAgo = new Date(today);
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            onStartChange(monthAgo.toISOString().split('T')[0]);
            onEndChange(today.toISOString().split('T')[0]);
          }}
          className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
        >
          最近30天
        </button>
        <button
          onClick={() => {
            onStartChange('');
            onEndChange('');
          }}
          className="px-3 py-2 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
        >
          全部数据
        </button>
      </div>
    </div>
  );
}

function OverviewCards({ overview, loading }) {
  if (loading || !overview) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 animate-pulse">
            <div className="space-y-3">
              <div className="h-4 bg-gray-200 rounded w-1/3"></div>
              <div className="h-8 bg-gray-200 rounded w-1/2"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-500 mb-1">练习会话</p>
            <p className="text-3xl font-bold text-gray-900">{overview.total_sessions}</p>
          </div>
          <div className="p-3 rounded-lg bg-blue-50 text-blue-600">
            <BookOpen className="w-6 h-6" />
          </div>
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-500 mb-1">总答题数</p>
            <p className="text-3xl font-bold text-gray-900">{overview.total_answers}</p>
          </div>
          <div className="p-3 rounded-lg bg-green-50 text-green-600">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-500 mb-1">答对题数</p>
            <p className="text-3xl font-bold text-gray-900">{overview.correct_answers}</p>
          </div>
          <div className="p-3 rounded-lg bg-blue-50 text-blue-600">
            <BookOpen className="w-6 h-6" />
          </div>
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-500 mb-1">总体正确率</p>
            <p className={`text-3xl font-bold ${
              overview.overall_accuracy >= 70 ? 'text-green-600' : 
              overview.overall_accuracy >= 40 ? 'text-yellow-600' : 'text-red-600'
            }`}>
              {overview.overall_accuracy}%
            </p>
          </div>
          <div className={`p-3 rounded-lg ${
            overview.overall_accuracy >= 70 ? 'bg-green-50 text-green-600' : 
            overview.overall_accuracy >= 40 ? 'bg-yellow-50 text-yellow-600' : 'bg-red-50 text-red-600'
          }`}>
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>
      </div>
    </div>
  );
}

function KnowledgePointChart({ data, loading }) {
  if (loading || !data || data.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">知识点掌握情况</h3>
        <div className="h-64 flex items-center justify-center text-gray-400">
          {loading ? '加载中...' : '暂无数据'}
        </div>
      </div>
    );
  }

  const chartData = data.map((d) => ({
    name: d.name.length > 8 ? d.name.substring(0, 8) + '...' : d.name,
    fullName: d.name,
    正确率: parseFloat(d.accuracy),
    答题数: d.total_answers,
  }));

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">知识点掌握情况</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis type="number" domain={[0, 100]} stroke="#6B7280" fontSize={12} />
            <YAxis dataKey="name" type="category" stroke="#6B7280" fontSize={11} width={80} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
              }}
              formatter={(value, name, props) => {
                return [`${value}% (答题${props.payload.答题数}题)`, name];
              }}
            />
            <Bar dataKey="正确率" radius={[0, 4, 4, 0]}>
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.正确率 >= 70 ? '#10B981' : entry.正确率 >= 40 ? '#F59E0B' : '#EF4444'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ErrorTagSection({ errorTags, loading }) {
  if (loading || !errorTags || errorTags.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">错因分布</h3>
        <div className="h-40 flex items-center justify-center text-gray-400">
          {loading ? '加载中...' : '暂无错题记录'}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 text-yellow-500" />
        错因分布
      </h3>
      <div className="space-y-4">
        {errorTags.map((tag, index) => {
          const maxCount = errorTags[0]?.count || 1;
          const percentage = (tag.count / maxCount) * 100;
          return (
            <div key={tag.tag}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-700">
                {index + 1}. {tag.label}
              </span>
              <span className="text-sm text-gray-500">{tag.count} 次</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className="bg-red-400 h-2 rounded-full transition-all"
                style={{ width: `${percentage}%` }}
              ></div>
            </div>
            {tag.description && (
              <p className="text-xs text-gray-400 mt-1">{tag.description}</p>
            )}
          </div>
        );
        })}
      </div>
    </div>
  );
}

function WeakPointsSection({ weakPoints, loading }) {
  if (loading || !weakPoints || weakPoints.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mt-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 text-yellow-500" />
        需要优先复习的知识点
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {weakPoints.map((kp, index) => (
          <div key={kp.id} className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <div className="flex items-start justify-between mb-2">
              <span className="text-xs font-medium text-yellow-700 bg-yellow-200 px-2 py-0.5 rounded">
                #{index + 1} 薄弱项
              </span>
              <span className="text-lg font-bold text-yellow-600">
                {kp.accuracy}%
              </span>
            </div>
            <h4 className="font-medium text-gray-900 mb-1">{kp.name}</h4>
            <p className="text-sm text-gray-500">
              答题 {kp.total_answers} 题，正确 {kp.correct_answers} 题
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function WrongNotesPreview({ wrongNotes, loading }) {
  if (loading || !wrongNotes || wrongNotes.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mt-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">代表性错题预览（最近{wrongNotes.length}道）</h3>
      <div className="space-y-4 max-h-96 overflow-y-auto">
        {wrongNotes.slice(0, 5).map((wn, index) => {
          const typeName = typeDescriptions[wn.type] || wn.type;
          return (
            <div key={wn.id} className="p-4 bg-red-50 rounded-lg border border-red-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">
                  错题 {index + 1}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                    {typeName}
                  </span>
                  <span className="text-xs text-gray-500">
                    难度: {'★'.repeat(wn.difficulty)}
                  </span>
                </div>
              </div>
              {wn.error_tags && wn.error_tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {wn.error_tags.map((tag, i) => (
                    <span key={i} className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <div className="text-sm text-gray-600">
                <p className="font-medium mb-1">题目:</p>
                <p className="bg-white p-2 rounded text-xs font-mono overflow-x-auto">
                  {JSON.stringify(wn.content)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ExportButtons({ startDate, endDate, onExport, exporting }) {
  const exportOptions = [
    { format: 'markdown', label: '导出 Markdown', icon: FileText, color: 'blue', description: '适合编辑和分享' },
    { format: 'html', label: '导出 HTML', icon: FileText, color: 'green', description: '适合浏览器查看' },
    { format: 'csv', label: '导出 CSV', icon: FileText, color: 'yellow', description: '适合表格处理' },
  ];

  const colorClasses = {
    blue: {
      button: 'bg-blue-500 hover:bg-blue-600 text-white',
      icon: 'bg-blue-100 text-blue-600',
    },
    green: {
      button: 'bg-green-500 hover:bg-green-600 text-white',
      icon: 'bg-green-100 text-green-600',
    },
    yellow: {
      button: 'bg-yellow-500 hover:bg-yellow-600 text-white',
      icon: 'bg-yellow-100 text-yellow-600',
    },
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mt-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Download className="w-5 h-5 text-blue-500" />
        导出报告
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {exportOptions.map((option) => {
          const Icon = option.icon;
          const classes = colorClasses[option.color];
          return (
            <button
              key={option.format}
              onClick={() => onExport(option.format)}
              disabled={exporting}
              className={`flex items-center gap-4 p-4 rounded-lg border-2 border-transparent hover:border-gray-200 transition-all ${
                exporting ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <div className={`p-3 rounded-lg ${classes.icon}`}>
                <Icon className="w-6 h-6" />
              </div>
              <div className="text-left">
                <p className="font-medium text-gray-900">{option.label}</p>
                <p className="text-sm text-gray-500">{option.description}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ReportsPage() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const loadReportData = async () => {
    try {
      setLoading(true);
      const params = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      
      const response = await reportsApi.getReportData(params);
      setReportData(response.data.data);
    } catch (error) {
      console.error('Failed to load report data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReportData();
  }, [startDate, endDate]);

  const handleExport = async (format) => {
    try {
      setExporting(true);
      const params = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      let response;
      let fileName = `music-theory-report.${format}`;
      let mimeType;

      switch (format) {
        case 'markdown':
          response = await reportsApi.exportMarkdown(params);
          mimeType = 'text/markdown';
          break;
        case 'html':
          response = await reportsApi.exportHTML(params);
          mimeType = 'text/html';
          break;
        case 'csv':
          response = await reportsApi.exportCSV(params);
          mimeType = 'text/csv';
          break;
        default:
          return;
      }

      const blob = new Blob([response.data], { type: mimeType });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export report:', error);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">练习报告</h2>
          <p className="text-gray-500 mt-1">查看和导出你的学习报告</p>
        </div>
      </div>

      <DateRangeSelector
        startDate={startDate}
        endDate={endDate}
        onStartChange={setStartDate}
        onEndChange={setEndDate}
      />

      <OverviewCards overview={reportData?.overview} loading={loading} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <KnowledgePointChart data={reportData?.byKnowledgePoint} loading={loading} />
        <ErrorTagSection errorTags={reportData?.errorTagCounts} loading={loading} />
      </div>

      <WeakPointsSection weakPoints={reportData?.weakKnowledgePoints} loading={loading} />

      <WrongNotesPreview wrongNotes={reportData?.representativeWrongNotes} loading={loading} />

      <ExportButtons
        startDate={startDate}
        endDate={endDate}
        onExport={handleExport}
        exporting={exporting}
      />
    </div>
  );
}

export default ReportsPage;
