import { useEffect, useMemo } from 'react';
import { useVibrationStore } from '@/store/useVibrationStore';
import { judgeThreshold } from '@/utils/threshold';
import { calculatePhysics, identifyHarmonicOrder } from '@/utils/physics';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { FileText, AlertTriangle, Clock, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DIRECTION_LABELS, THRESHOLD_BOUNDARIES } from '@/types';
import type { DataSource } from '@/types';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const THRESHOLD_BORDER_MAP: Record<string, string> = {
  '正常': 'border-l-emerald-500',
  '警告': 'border-l-amber-500',
  '危险': 'border-l-red-500',
};

const THRESHOLD_BG_LIGHT_MAP: Record<string, string> = {
  '正常': 'bg-emerald-50 text-emerald-700',
  '警告': 'bg-amber-50 text-amber-700',
  '危险': 'bg-red-50 text-red-700',
};

function getJudgmentBasis(amplitudeMmPerS: number, frequencyHz: number, rpm: number, amplitudeUnit: string): string {
  const parts: string[] = [];

  if (amplitudeMmPerS < THRESHOLD_BOUNDARIES.normal) {
    parts.push(`幅值 ${amplitudeMmPerS.toFixed(2)} mm/s < ${THRESHOLD_BOUNDARIES.normal} mm/s（正常区间）`);
  } else if (amplitudeMmPerS < THRESHOLD_BOUNDARIES.warning) {
    parts.push(`幅值 ${amplitudeMmPerS.toFixed(2)} mm/s 处于 ${THRESHOLD_BOUNDARIES.normal}~${THRESHOLD_BOUNDARIES.warning} mm/s（警告区间）`);
  } else {
    parts.push(`幅值 ${amplitudeMmPerS.toFixed(2)} mm/s ≥ ${THRESHOLD_BOUNDARIES.warning} mm/s（危险区间）`);
  }

  if (rpm > 0) {
    const physics = calculatePhysics(amplitudeMmPerS, frequencyHz, rpm);
    const harmonicOrder = identifyHarmonicOrder(frequencyHz, physics.fundamentalHz);
    if (harmonicOrder !== null) {
      parts.push(`${harmonicOrder}倍频分量`);
    }
  }

  if (amplitudeUnit !== 'mm/s') {
    parts.push(`原始单位 ${amplitudeUnit} 已换算`);
  }

  return parts.join('；');
}

export default function ReportPage() {
  const { compressors, selectedCompressorId, getRecordsByCompressor } = useVibrationStore();

  const compressor = compressors.find((c) => c.id === selectedCompressorId);
  const records = getRecordsByCompressor(selectedCompressorId);

  const sourceSummary = useMemo(() => {
    const counts: Record<DataSource, number> = { '实验表': 0, '照片说明': 0, '维修微信群': 0 };
    records.forEach((r) => { counts[r.dataSource]++; });
    return counts;
  }, [records]);

  const now = useMemo(() => new Date(), []);
  const formattedTime = now.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const sortedRecords = useMemo(() => {
    return [...records].sort((a, b) => new Date(a.recordTime).getTime() - new Date(b.recordTime).getTime());
  }, [records]);

  const anomalyRecords = useMemo(() => {
    return sortedRecords.filter((r) => r.status === '需确认' || r.status === '旧口径');
  }, [sortedRecords]);

  const chartData = useMemo(() => {
    const sorted = [...records].sort((a, b) => new Date(a.recordTime).getTime() - new Date(b.recordTime).getTime());
    return {
      labels: sorted.map((r) => {
        const d = new Date(r.recordTime);
        return `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
      }),
      datasets: [
        {
          label: '振动幅值 (mm/s)',
          data: sorted.map((r) => r.amplitudeMmPerS),
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 3,
          pointHoverRadius: 5,
        },
        {
          label: `警告阈值 (${THRESHOLD_BOUNDARIES.normal} mm/s)`,
          data: sorted.map(() => THRESHOLD_BOUNDARIES.normal),
          borderColor: '#f59e0b',
          borderDash: [6, 4],
          pointRadius: 0,
          fill: false,
        },
        {
          label: `危险阈值 (${THRESHOLD_BOUNDARIES.warning} mm/s)`,
          data: sorted.map(() => THRESHOLD_BOUNDARIES.warning),
          borderColor: '#ef4444',
          borderDash: [6, 4],
          pointRadius: 0,
          fill: false,
        },
      ],
    };
  }, [records]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' as const, labels: { font: { size: 11 } } },
      tooltip: { mode: 'index' as const, intersect: false },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: { display: true, text: '幅值 (mm/s)' },
      },
      x: {
        title: { display: true, text: '时间' },
        ticks: { maxRotation: 45, font: { size: 10 } },
      },
    },
  }), []);

  useEffect(() => {
    ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);
  }, []);

  return (
    <div className="min-h-screen bg-[#1a1d23] py-8 px-4">
      <div className="max-w-[900px] mx-auto bg-[#f8f9fa] rounded-lg shadow-2xl overflow-hidden">
        {/* A) Report Header */}
        <div className="px-10 pt-10 pb-6 border-b border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <FileText className="w-7 h-7 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">压缩机振动频谱分析报告</h1>
          </div>
          <div className="grid grid-cols-2 gap-y-2 text-sm text-gray-700">
            <div>
              <span className="font-semibold">压缩机名称：</span>
              {compressor?.name ?? '-'}
            </div>
            <div>
              <span className="font-semibold">型号：</span>
              {compressor?.model ?? '-'}
            </div>
            <div>
              <span className="font-semibold">分析时间：</span>
              {formattedTime}
            </div>
            <div>
              <span className="font-semibold">记录总数：</span>
              {records.length} 条
            </div>
          </div>
          <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
            <span className="font-semibold text-gray-600">数据来源统计：</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-700">实验表 {sourceSummary['实验表']} 条</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-green-50 text-green-700">照片说明 {sourceSummary['照片说明']} 条</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-orange-50 text-orange-700">维修微信群 {sourceSummary['维修微信群']} 条</span>
          </div>
        </div>

        {/* B) Spectrum Chart */}
        <div className="px-10 py-6 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-800 mb-3">频谱趋势图</h2>
          <div style={{ height: 250 }}>
            <Line data={chartData} options={chartOptions} />
          </div>
        </div>

        {/* C) Judgment Detail Table */}
        <div className="px-10 py-6 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-800 mb-3">判定明细表</h2>
          {sortedRecords.length === 0 ? (
            <p className="text-sm text-gray-400">暂无记录</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-gray-600">
                    <th className="px-2 py-2 text-left font-semibold">序号</th>
                    <th className="px-2 py-2 text-left font-semibold">时间</th>
                    <th className="px-2 py-2 text-left font-semibold">方向</th>
                    <th className="px-2 py-2 text-left font-semibold">频率(Hz)</th>
                    <th className="px-2 py-2 text-left font-semibold">幅值(原始)</th>
                    <th className="px-2 py-2 text-left font-semibold">幅值(mm/s)</th>
                    <th className="px-2 py-2 text-left font-semibold">阈值判定</th>
                    <th className="px-2 py-2 text-left font-semibold">判定依据</th>
                    <th className="px-2 py-2 text-left font-semibold">数据来源</th>
                    <th className="px-2 py-2 text-left font-semibold">人工确认</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRecords.map((record, idx) => {
                    const threshold = judgeThreshold(record.amplitudeMmPerS);
                    const basis = getJudgmentBasis(record.amplitudeMmPerS, record.frequencyHz, record.rpm, record.amplitudeUnit);
                    const borderClass = THRESHOLD_BORDER_MAP[threshold.level] ?? 'border-l-gray-300';
                    const badgeClass = THRESHOLD_BG_LIGHT_MAP[threshold.level] ?? 'bg-gray-50 text-gray-700';

                    let confirmText = '';
                    if (record.status === '需确认' || record.status === '旧口径') {
                      confirmText = record.confirmationNote || '待确认';
                    } else if (record.confirmationNote) {
                      confirmText = record.confirmationNote;
                    }

                    return (
                      <tr
                        key={record.id}
                        className={cn('border-l-4', borderClass, 'border-b border-gray-100 hover:bg-gray-50')}
                      >
                        <td className="px-2 py-2 text-gray-500">{idx + 1}</td>
                        <td className="px-2 py-2 text-gray-700 whitespace-nowrap">
                          {new Date(record.recordTime).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-2 py-2 text-gray-700">{DIRECTION_LABELS[record.direction]}</td>
                        <td className="px-2 py-2 text-gray-700">{record.frequencyHz}</td>
                        <td className="px-2 py-2 text-gray-700 whitespace-nowrap">
                          {record.amplitude} {record.amplitudeUnit}
                          {record.isExtreme && <span className="ml-1">⚠️</span>}
                        </td>
                        <td className="px-2 py-2 text-gray-700">
                          {record.amplitudeMmPerS.toFixed(2)}
                          {record.isExtreme && <span className="ml-1">⚠️</span>}
                        </td>
                        <td className="px-2 py-2">
                          <span className={cn('inline-block px-1.5 py-0.5 rounded text-[10px] font-medium', badgeClass)}>
                            {threshold.level}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-gray-600 max-w-[180px]">{basis}</td>
                        <td className="px-2 py-2 text-gray-600">{record.dataSource}</td>
                        <td className="px-2 py-2">
                          {confirmText ? (
                            <span className={cn(
                              'text-[10px]',
                              (record.status === '需确认' || record.status === '旧口径') && !record.confirmationNote
                                ? 'text-amber-600 font-medium'
                                : 'text-gray-600'
                            )}>
                              {confirmText}
                            </span>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* D) Anomaly Notes Section */}
        {anomalyRecords.length > 0 && (
          <div className="px-10 py-6 border-b border-gray-200">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <h2 className="text-base font-semibold text-gray-800">异常备注区</h2>
            </div>
            <div className="space-y-3">
              {anomalyRecords.map((record) => {
                const threshold = judgeThreshold(record.amplitudeMmPerS);
                const borderColor = record.status === '旧口径' ? 'border-l-red-500' : 'border-l-amber-500';

                return (
                  <div key={record.id} className={cn('border-l-4', borderColor, 'bg-white rounded-r-lg shadow-sm p-4')}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="text-sm text-gray-800 font-medium">
                        {new Date(record.recordTime).toLocaleString('zh-CN')} · {DIRECTION_LABELS[record.direction]} · {record.frequencyHz} Hz · {record.amplitude} {record.amplitudeUnit} → {record.amplitudeMmPerS.toFixed(2)} mm/s
                      </div>
                      <span className={cn(
                        'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium',
                        THRESHOLD_BG_LIGHT_MAP[threshold.level]
                      )}>
                        {threshold.level}
                      </span>
                    </div>

                    {record.status === '旧口径' && (
                      <div className="flex items-center gap-1.5 mb-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded text-xs text-red-700 font-medium">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        此记录按旧口径补录，数据可靠性需评估
                      </div>
                    )}

                    {record.validationNotes.length > 0 && (
                      <ul className="space-y-1 mb-2">
                        {record.validationNotes.map((note, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600">
                            <span className="mt-0.5 shrink-0 text-amber-500">•</span>
                            <span>{note}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {record.confirmationNote && (
                      <div className="flex items-start gap-1.5 text-xs text-emerald-700 bg-emerald-50 rounded px-3 py-1.5">
                        <CheckCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>{record.confirmationNote}</span>
                      </div>
                    )}

                    <div className="mt-2">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100 text-gray-600 text-[10px] font-medium">
                        数据来源：{record.dataSource}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* E) Report Footer */}
        <div className="px-10 py-6 bg-gray-50 text-xs text-gray-500 space-y-1">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            <span>报告生成时间：{formattedTime}</span>
          </div>
          <div>分析工具：压缩机振动频谱分析看板 v1.0</div>
          <div className="text-amber-600 mt-2">
            本报告由系统自动生成，异常记录需人工确认后方可作为设备维护依据
          </div>
        </div>
      </div>
    </div>
  );
}
