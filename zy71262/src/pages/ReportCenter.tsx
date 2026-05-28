import { useState } from 'react';
import { FileDown, CheckCircle, AlertTriangle, XCircle, BarChart3 } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Navbar } from '../components/layout/Navbar';
import { usePigmentStore } from '../store/usePigmentStore';
import { exportPigmentsToExcel } from '../utils/excelExporter';
import { STATUS_LABELS, ANOMALY_LABELS } from '../types';

export function ReportCenter() {
  const { pigments, getStatistics, initStore } = usePigmentStore();
  const [isExporting, setIsExporting] = useState(false);

  useState(() => {
    initStore();
  });

  const stats = getStatistics();

  const chartData = [
    { name: '已处理', value: stats.processed, color: '#10b981' },
    { name: '待确认', value: stats.pending, color: '#f59e0b' },
    { name: '需退回', value: stats.rejected, color: '#ef4444' },
  ];

  const anomalyStats = pigments.reduce((acc, p) => {
    p.anomalies.forEach(a => {
      acc[a] = (acc[a] || 0) + 1;
    });
    return acc;
  }, {} as Record<string, number>);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      exportPigmentsToExcel(pigments, '色料配方报告.xlsx');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-slate-900">
      <Navbar />
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white">报告中心</h1>
              <p className="text-slate-400">查看统计数据和导出报告</p>
            </div>
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <FileDown className="w-4 h-4" />
              {isExporting ? '导出中...' : '导出Excel报告'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400 text-sm">色料总数</span>
                <BarChart3 className="w-5 h-5 text-blue-400" />
              </div>
              <div className="text-3xl font-bold text-white">{stats.total}</div>
            </div>
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400 text-sm">已处理</span>
                <CheckCircle className="w-5 h-5 text-emerald-500" />
              </div>
              <div className="text-3xl font-bold text-emerald-500">{stats.processed}</div>
            </div>
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400 text-sm">待确认</span>
                <AlertTriangle className="w-5 h-5 text-amber-500" />
              </div>
              <div className="text-3xl font-bold text-amber-500">{stats.pending}</div>
            </div>
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400 text-sm">需退回</span>
                <XCircle className="w-5 h-5 text-red-500" />
              </div>
              <div className="text-3xl font-bold text-red-500">{stats.rejected}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">状态分布</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: '8px',
                      }}
                      labelStyle={{ color: '#f1f5f9' }}
                    />
                    <Legend
                      formatter={(value) => <span className="text-slate-300">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">异常统计</h3>
              <div className="space-y-4">
                {Object.entries(anomalyStats).length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    暂无异常数据
                  </div>
                ) : (
                  Object.entries(anomalyStats).map(([type, count]) => (
                    <div key={type} className="flex items-center gap-4">
                      <div className="w-32 text-sm text-slate-400">
                        {ANOMALY_LABELS[type as keyof typeof ANOMALY_LABELS]}
                      </div>
                      <div className="flex-1">
                        <div className="h-6 bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber-500 rounded-full transition-all"
                            style={{ width: `${(count / stats.total) * 100}%` }}
                          />
                        </div>
                      </div>
                      <div className="w-16 text-right text-sm font-medium text-white">
                        {count} 条
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 bg-slate-800 rounded-xl border border-slate-700 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">报告说明</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
              <div>
                <h4 className="font-medium text-emerald-400 mb-2">已处理</h4>
                <p className="text-slate-400">
                  数据完整、配方比例正确、耐光等级已测、成本在正常范围内的色料记录。
                </p>
              </div>
              <div>
                <h4 className="font-medium text-amber-400 mb-2">待确认</h4>
                <p className="text-slate-400">
                  存在配方比例不满100%、耐光等级未测或成本异常的数据，需要人工审核确认。
                </p>
              </div>
              <div>
                <h4 className="font-medium text-red-400 mb-2">需退回</h4>
                <p className="text-slate-400">
                  存在必填字段缺失或严重数据问题，需要退回补充材料后重新提交。
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 bg-slate-800 rounded-xl border border-slate-700 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">导出内容</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="bg-slate-700/50 rounded-lg p-4">
                <div className="font-medium text-white mb-1">全部色料</div>
                <div className="text-slate-400">包含所有色料的完整列表</div>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-4">
                <div className="font-medium text-white mb-1">状态分类</div>
                <div className="text-slate-400">按处理状态分工作表展示</div>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-4">
                <div className="font-medium text-white mb-1">配方明细</div>
                <div className="text-slate-400">各成分比例详细清单</div>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-4">
                <div className="font-medium text-white mb-1">统计汇总</div>
                <div className="text-slate-400">各类别数量统计数据</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
