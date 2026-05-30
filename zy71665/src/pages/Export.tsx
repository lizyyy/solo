import { useRef } from 'react';
import { useFiberStore } from '@/store';
import { ANOMALY_TYPE_LABELS } from '@/types';
import type { AnomalyType, DataSource } from '@/types';
import { exportToCsv, exportToImage, getDefaultFilter } from '@/utils/export';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, Legend,
} from 'recharts';
import { Filter, Download, Image, FileSpreadsheet, RotateCcw } from 'lucide-react';

export default function ExportPage() {
  const filter = useFiberStore((s) => s.filter);
  const setFilter = useFiberStore((s) => s.setFilter);
  const resetFilter = useFiberStore((s) => s.resetFilter);
  const getFilteredRecords = useFiberStore((s) => s.getFilteredRecords);
  const getFilteredResults = useFiberStore((s) => s.getFilteredResults);
  const getFilteredAnomalies = useFiberStore((s) => s.getFilteredAnomalies);
  const records = getFilteredRecords();
  const results = getFilteredResults();
  const anomalies = getFilteredAnomalies();

  const chartRef = useRef<HTMLDivElement>(null);

  const resultMap = new Map(results.map((r) => [r.recordId, r]));
  const wavelengthLossData = records
    .map((r) => {
      const res = resultMap.get(r.id);
      if (!res || res.lossPerKm === Infinity) return null;
      return { wavelength: r.wavelength, lossPerKm: res.lossPerKm, id: r.id.slice(0, 8) };
    })
    .filter(Boolean) as { wavelength: number; lossPerKm: number; id: string }[];

  const lengthLossData = records
    .map((r) => {
      const res = resultMap.get(r.id);
      if (!res || res.lossPerKm === Infinity) return null;
      return { length: r.fiberLength, lossPerKm: res.lossPerKm, id: r.id.slice(0, 8) };
    })
    .filter(Boolean) as { length: number; lossPerKm: number; id: string }[];

  const anomalyTypes: AnomalyType[] = ['unit_error', 'zero_length', 'duplicate_connector'];
  const dataSources: DataSource[] = ['system', 'manual'];

  const handleExportCsv = () => {
    exportToCsv(records, results, anomalies);
  };

  const handleExportImage = async () => {
    if (chartRef.current) {
      await exportToImage('chart-area', `光纤损耗图表_${new Date().toISOString().slice(0, 10)}.png`);
    }
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#1B2A4A]">筛选与导出</h2>
          <p className="text-sm text-gray-500 mt-0.5">按条件筛选数据，生成图表，导出与当前视图一致的报告</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={16} className="text-[#E8A838]" />
          <span className="text-sm font-semibold text-[#1B2A4A]">筛选条件</span>
          <button
            onClick={resetFilter}
            className="ml-auto flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            <RotateCcw size={12} />
            重置
          </button>
        </div>
        <div className="grid grid-cols-4 gap-4">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">波长范围 (nm)</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={filter.wavelengthRange[0]}
                onChange={(e) => setFilter({ wavelengthRange: [parseFloat(e.target.value) || 0, filter.wavelengthRange[1]] })}
                className="w-full px-2 py-1.5 rounded-md border border-gray-200 text-xs"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              />
              <span className="text-gray-300">—</span>
              <input
                type="number"
                value={filter.wavelengthRange[1]}
                onChange={(e) => setFilter({ wavelengthRange: [filter.wavelengthRange[0], parseFloat(e.target.value) || 2000] })}
                className="w-full px-2 py-1.5 rounded-md border border-gray-200 text-xs"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">长度范围 (km)</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={filter.lengthRange[0]}
                onChange={(e) => setFilter({ lengthRange: [parseFloat(e.target.value) || 0, filter.lengthRange[1]] })}
                className="w-full px-2 py-1.5 rounded-md border border-gray-200 text-xs"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              />
              <span className="text-gray-300">—</span>
              <input
                type="number"
                value={filter.lengthRange[1]}
                onChange={(e) => setFilter({ lengthRange: [filter.lengthRange[0], parseFloat(e.target.value) || 1000] })}
                className="w-full px-2 py-1.5 rounded-md border border-gray-200 text-xs"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">异常类型</label>
            <div className="space-y-1">
              {anomalyTypes.map((type) => (
                <label key={type} className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filter.anomalyTypes.includes(type)}
                    onChange={(e) => {
                      const newTypes = e.target.checked
                        ? [...filter.anomalyTypes, type]
                        : filter.anomalyTypes.filter((t) => t !== type);
                      setFilter({ anomalyTypes: newTypes });
                    }}
                    className="rounded border-gray-300 text-[#E8A838] focus:ring-[#E8A838]"
                  />
                  {ANOMALY_TYPE_LABELS[type]}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">数据来源</label>
            <div className="space-y-1">
              {dataSources.map((ds) => (
                <label key={ds} className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filter.dataSource.includes(ds)}
                    onChange={(e) => {
                      const newSources = e.target.checked
                        ? [...filter.dataSource, ds]
                        : filter.dataSource.filter((s) => s !== ds);
                      setFilter({ dataSource: newSources });
                    }}
                    className="rounded border-gray-300 text-[#E8A838] focus:ring-[#E8A838]"
                  />
                  {ds === 'system' ? '系统导出' : '手动填写'}
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
          当前筛选结果：{records.length} 条记录 / {results.length} 条计算结果 / {anomalies.length} 个异常
        </div>
      </div>

      {results.length > 0 && (
        <div id="chart-area" ref={chartRef} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[#1B2A4A]">
              图表 — 波长 {filter.wavelengthRange[0]}-{filter.wavelengthRange[1]} nm / 长度 {filter.lengthRange[0]}-{filter.lengthRange[1]} km
            </h3>
            <div className="flex gap-2">
              <button
                onClick={handleExportCsv}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 hover:bg-emerald-100 transition-colors"
              >
                <FileSpreadsheet size={13} />
                导出CSV
              </button>
              <button
                onClick={handleExportImage}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-50 border border-blue-200 text-xs text-blue-700 hover:bg-blue-100 transition-colors"
              >
                <Image size={13} />
                导出图片
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <h4 className="text-xs text-gray-500 mb-2">损耗 — 波长曲线</h4>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={wavelengthLossData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="wavelength" tick={{ fontSize: 11 }} label={{ value: '波长 (nm)', position: 'insideBottom', offset: -5, fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} label={{ value: 'dB/km', angle: -90, position: 'insideLeft', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}
                    formatter={(value: number) => [value.toFixed(3), '损耗系数']}
                    labelFormatter={(label: number) => `波长: ${label} nm`}
                  />
                  <Line type="monotone" dataKey="lossPerKm" stroke="#E8A838" strokeWidth={2} dot={{ fill: '#1B2A4A', r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div>
              <h4 className="text-xs text-gray-500 mb-2">损耗 — 长度散点</h4>
              <ResponsiveContainer width="100%" height={280}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="length" tick={{ fontSize: 11 }} name="长度" unit="km" label={{ value: '长度 (km)', position: 'insideBottom', offset: -5, fontSize: 11 }} />
                  <YAxis dataKey="lossPerKm" tick={{ fontSize: 11 }} name="损耗" unit=" dB/km" label={{ value: 'dB/km', angle: -90, position: 'insideLeft', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}
                    formatter={(value: number, name: string) => [value.toFixed(3), name === 'lossPerKm' ? '损耗系数' : name]}
                  />
                  <Legend />
                  <Scatter name="光纤损耗" data={lengthLossData} fill="#1B2A4A" />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {records.length > 0 && results.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#1B2A4A]">当前筛选结果明细</h3>
            <span className="text-xs text-gray-400">导出内容与上表一致</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500">
                  <th className="px-4 py-2.5 text-left font-medium">来源</th>
                  <th className="px-4 py-2.5 text-right font-medium">长度</th>
                  <th className="px-4 py-2.5 text-right font-medium">波长</th>
                  <th className="px-4 py-2.5 text-right font-medium">损耗(dB)</th>
                  <th className="px-4 py-2.5 text-right font-medium">dB/km</th>
                  <th className="px-4 py-2.5 text-right font-medium">接头损耗</th>
                  <th className="px-4 py-2.5 text-right font-medium">总损耗</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => {
                  const res = resultMap.get(r.id);
                  return (
                    <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-2.5">
                        <span className={`text-xs px-2 py-0.5 rounded ${r.dataSource === 'system' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                          {r.dataSource === 'system' ? '系统' : '手动'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        {r.fiberLength} {r.lengthUnit}
                      </td>
                      <td className="px-4 py-2.5 text-right" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        {r.wavelength} {r.wavelengthUnit}
                      </td>
                      <td className="px-4 py-2.5 text-right" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        {res?.lossDB ?? '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        {res?.lossPerKm === Infinity ? '∞' : res?.lossPerKm ?? '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        {res?.connectorLoss ?? '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        {res?.totalLoss === Infinity ? '—' : res?.totalLoss ?? '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
