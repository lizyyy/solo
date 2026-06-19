import { useState } from 'react';
import {
  FileBarChart,
  Calendar,
  Download,
  RefreshCw,
  CheckCircle2,
  Music,
  DollarSign,
  FileText,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAppStore } from '../store';
import { formatCurrency, formatDateTime, getWeekNumber, downloadCSV } from '../utils/helpers';

export default function WeeklyReport() {
  const { weeklyReports, generateWeeklyReport } = useAppStore();
  const currentWeek = getWeekNumber(new Date());
  const [selectedWeek, setSelectedWeek] = useState(currentWeek.week);
  const [selectedYear, setSelectedYear] = useState(currentWeek.year);
  const [generating, setGenerating] = useState(false);

  const currentReport = weeklyReports.find(
    (r) => r.weekNumber === selectedWeek && r.year === selectedYear
  );

  const handleGenerate = () => {
    setGenerating(true);
    setTimeout(() => {
      generateWeeklyReport(selectedWeek, selectedYear);
      setGenerating(false);
    }, 500);
  };

  const handleExport = () => {
    if (!currentReport) return;
    const rows = [
      ['标准曲目名', '曲目数量', '总金额'],
      ...currentReport.details.map((d) => [
        d.canonicalName,
        d.trackCount.toString(),
        d.totalAmount.toString(),
      ]),
      ['', '', ''],
      ['合计', currentReport.trackCount.toString(), currentReport.totalAmount.toString()],
    ];
    downloadCSV(rows, `周报-${selectedYear}年第${selectedWeek}周.csv`);
  };

  const chartData = currentReport?.details.map((d) => ({
    name: d.canonicalName.length > 6 ? d.canonicalName.slice(0, 6) + '...' : d.canonicalName,
    fullName: d.canonicalName,
    金额: d.totalAmount,
  })) || [];

  const weekOptions = Array.from({ length: 52 }, (_, i) => i + 1);

  return (
    <div className="space-y-6">
      <div className="bg-sky-50 border border-sky-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <FileBarChart className="w-5 h-5 text-sky-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-sky-800 mb-0.5">给店长看的周报</h4>
            <p className="text-xs text-sky-700">
              按标准曲目名汇总，确保同一首歌的现场名和版权名都归集到同一个标准名下，数字不会被盖过去。
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-slate-600" />
            选择周次
          </h3>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="px-3 py-1.5 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
              >
                {[2025, 2026, 2027].map((y) => (
                  <option key={y} value={y}>
                    {y}年
                  </option>
                ))}
              </select>
              <select
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(parseInt(e.target.value))}
                className="px-3 py-1.5 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
              >
                {weekOptions.map((w) => (
                  <option key={w} value={w}>
                    第 {w} 周
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="px-4 py-1.5 bg-slate-800 text-white text-sm rounded-md hover:bg-slate-700 transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {generating ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  生成/刷新周报
                </>
              )}
            </button>
            {currentReport && (
              <button
                onClick={handleExport}
                className="px-4 py-1.5 bg-emerald-600 text-white text-sm rounded-md hover:bg-emerald-700 transition-colors flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                导出 CSV
              </button>
            )}
          </div>
        </div>

        {currentReport ? (
          <div className="space-y-6">
            <div className="grid grid-cols-4 gap-4">
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-800">{currentReport.contractCount}</p>
                    <p className="text-xs text-slate-500">合同数</p>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center">
                    <Music className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-800">{currentReport.trackCount}</p>
                    <p className="text-xs text-slate-500">曲目数</p>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-slate-800">
                      {formatCurrency(currentReport.totalAmount)}
                    </p>
                    <p className="text-xs text-slate-500">总金额</p>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-sky-600 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700 mt-1">
                      {currentReport.details.length} 个标准曲目
                    </p>
                    <p className="text-xs text-slate-500">已归集</p>
                  </div>
                </div>
              </div>
            </div>

            {chartData.length > 0 && (
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <h4 className="text-sm font-semibold text-slate-700 mb-4">曲目金额分布</h4>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="name" fontSize={12} tick={{ fill: '#64748b' }} />
                      <YAxis fontSize={12} tick={{ fill: '#64748b' }} />
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value)}
                        labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
                      />
                      <Bar dataKey="金额" fill="#1e3a5f" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                <h4 className="text-sm font-semibold text-slate-700">明细列表</h4>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="text-left py-3 px-4 font-medium text-slate-600">标准曲目名</th>
                    <th className="text-center py-3 px-4 font-medium text-slate-600 w-[15%]">
                      曲目数量
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-slate-600 w-[20%]">
                      总金额
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {currentReport.details.map((d, idx) => (
                    <tr key={idx} className="border-b border-slate-50 last:border-0">
                      <td className="py-3 px-4 font-medium text-slate-800">
                        {d.canonicalName}
                      </td>
                      <td className="py-3 px-4 text-center text-slate-600">{d.trackCount}</td>
                      <td className="py-3 px-4 text-right font-medium text-slate-800">
                        {formatCurrency(d.totalAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-800 text-white">
                    <td className="py-3 px-4 font-semibold">合计</td>
                    <td className="py-3 px-4 text-center font-semibold">
                      {currentReport.trackCount}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold">
                      {formatCurrency(currentReport.totalAmount)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <p className="text-xs text-slate-400 text-right">
              生成时间：{formatDateTime(new Date(currentReport.generatedAt))}
            </p>
          </div>
        ) : (
          <div className="text-center py-16 text-slate-400">
            <FileBarChart className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg mb-2">暂无本周周报</p>
            <p className="text-sm">点击上方"生成/刷新周报"按钮生成</p>
          </div>
        )}
      </div>
    </div>
  );
}
