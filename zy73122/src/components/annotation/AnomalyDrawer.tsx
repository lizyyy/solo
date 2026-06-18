import { X, BookOpen, Calculator, MapPin, AlertTriangle } from 'lucide-react';
import type { BuoyRecord } from '../../types';
import { formatLatitude, formatLongitude } from '../../utils/coordinate';

interface Props {
  record: BuoyRecord | null;
  onClose: () => void;
}

export default function AnomalyDrawer({ record, onClose }: Props) {
  if (!record) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="ml-auto w-full max-w-2xl bg-white shadow-2xl animate-slide-in flex flex-col h-full">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-alert-400/10 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-alert-400/20 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-alert-500" />
            </div>
            <div>
              <h3 className="font-medium text-slate-800">异常详情追溯</h3>
              <p className="text-xs text-slate-500">{record.buoyId} · {new Date(record.recordTime).toLocaleString('zh-CN')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="w-4 h-4 text-ocean-600" />
              <h4 className="text-sm font-medium text-slate-700">原始船上记录本</h4>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-lg p-3 border border-slate-200">
                  <p className="text-xs text-slate-500 mb-1">船上纬度写法</p>
                  <p className="text-sm font-mono text-slate-800">{record.rawLogEntry.latRaw}</p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-slate-200">
                  <p className="text-xs text-slate-500 mb-1">船上经度写法</p>
                  <p className="text-sm font-mono text-slate-800">{record.rawLogEntry.lonRaw}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-lg p-3 border border-slate-200">
                  <p className="text-xs text-slate-500 mb-1">记录本页码</p>
                  <p className="text-sm text-slate-800">{record.rawLogEntry.logPage}</p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-slate-200">
                  <p className="text-xs text-slate-500 mb-1">记录日期</p>
                  <p className="text-sm text-slate-800">{record.rawLogEntry.logDate}</p>
                </div>
              </div>
              {record.rawLogEntry.notes && (
                <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
                  <p className="text-xs text-yellow-700 mb-1">船上原始备注</p>
                  <p className="text-sm text-yellow-800">{record.rawLogEntry.notes}</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-ocean-50/50 rounded-xl p-4 border border-ocean-200">
            <div className="flex items-center gap-2 mb-3">
              <Calculator className="w-4 h-4 text-ocean-600" />
              <h4 className="text-sm font-medium text-slate-700">本次计算口径</h4>
            </div>
            <div className="space-y-3">
              <div className="bg-white rounded-lg p-3 border border-ocean-100">
                <p className="text-xs text-slate-500 mb-1">计算公式</p>
                <p className="text-sm font-mono text-ocean-700">{record.calculationCriteria.formula}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-lg p-3 border border-ocean-100">
                  <p className="text-xs text-slate-500 mb-1">异常阈值</p>
                  <p className="text-sm text-alert-500 font-medium">
                    ≥ {record.calculationCriteria.threshold} 级
                  </p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-ocean-100">
                  <p className="text-xs text-slate-500 mb-1">当前海况</p>
                  <p className="text-sm text-slate-800 font-medium">
                    {record.seaState} 级
                    <span className="text-xs text-slate-400 ml-1">
                      (超阈值 {(record.seaState - record.calculationCriteria.threshold).toFixed(1)} 级)
                    </span>
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-lg p-3 border border-ocean-100">
                  <p className="text-xs text-slate-500 mb-1">口径版本</p>
                  <p className="text-sm text-slate-800 font-mono">{record.calculationCriteria.version}</p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-ocean-100">
                  <p className="text-xs text-slate-500 mb-1">计算时间</p>
                  <p className="text-sm text-slate-800">
                    {new Date(record.calculationCriteria.calculatedAt).toLocaleString('zh-CN')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-green-50/50 rounded-xl p-4 border border-green-200">
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="w-4 h-4 text-green-600" />
              <h4 className="text-sm font-medium text-slate-700">经纬度映射关系</h4>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-white rounded-lg p-3 border border-green-100">
                <div>
                  <p className="text-xs text-slate-500">船上写法</p>
                  <p className="text-sm font-mono text-slate-700">{record.rawLogEntry.latRaw}</p>
                </div>
                <div className="text-green-500 px-2">→</div>
                <div className="text-right">
                  <p className="text-xs text-slate-500">标准十进制度</p>
                  <p className="text-sm font-mono text-green-700">{record.latitude.toFixed(5)}°N</p>
                </div>
              </div>
              <div className="flex items-center justify-between bg-white rounded-lg p-3 border border-green-100">
                <div>
                  <p className="text-xs text-slate-500">船上写法</p>
                  <p className="text-sm font-mono text-slate-700">{record.rawLogEntry.lonRaw}</p>
                </div>
                <div className="text-green-500 px-2">→</div>
                <div className="text-right">
                  <p className="text-xs text-slate-500">标准十进制度</p>
                  <p className="text-sm font-mono text-green-700">{record.longitude.toFixed(5)}°E</p>
                </div>
              </div>
              <p className="text-xs text-slate-400 text-center">
                转换规则：度 + 分/60 = 十进制度
              </p>
            </div>
          </div>

          {record.manualRemark && (
            <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
              <p className="text-xs text-purple-600 mb-1 font-medium">人工备注</p>
              <p className="text-sm text-purple-800">{record.manualRemark}</p>
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 px-6 py-4 bg-slate-50">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2 px-4 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-white transition-colors"
            >
              关闭
            </button>
            <button
              className="flex-1 py-2 px-4 bg-ocean-600 text-white rounded-lg text-sm font-medium hover:bg-ocean-700 transition-colors"
              onClick={onClose}
            >
              标记为已复核
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
