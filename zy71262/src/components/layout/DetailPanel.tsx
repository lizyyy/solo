import { useState } from 'react';
import { X, AlertTriangle, CheckCircle, XCircle, Copy, Plus, Eye } from 'lucide-react';
import { Pigment, ANOMALY_LABELS, SimilarPigmentResult } from '../../types';
import { usePigmentStore } from '../../store/usePigmentStore';
import { useSchemeStore } from '../../store/useSchemeStore';

interface DetailPanelProps {
  pigment: Pigment | undefined;
  similarPigments: SimilarPigmentResult[];
  onClose: () => void;
}

export function DetailPanel({ pigment, similarPigments, onClose }: DetailPanelProps) {
  const { selectPigment, updatePigmentStatus } = usePigmentStore();
  const { schemes, addPigmentToScheme } = useSchemeStore();
  const [showSchemeModal, setShowSchemeModal] = useState(false);

  if (!pigment) {
    return (
      <div className="w-80 bg-slate-800 border-l border-slate-700 flex flex-col h-full">
        <div className="flex-1 flex items-center justify-center text-slate-500">
          <div className="text-center">
            <Eye className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>点击3D立方中的色料点</p>
            <p className="text-sm">查看详细信息</p>
          </div>
        </div>
      </div>
    );
  }

  const statusConfig = {
    processed: { icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-500/10', label: '已处理' },
    pending: { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-500/10', label: '待确认' },
    rejected: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10', label: '需退回' },
  };

  const status = statusConfig[pigment.status];
  const StatusIcon = status.icon;

  const formulaTotal = pigment.formula.reduce((sum, f) => sum + f.ratio, 0);

  return (
    <div className="w-80 bg-slate-800 border-l border-slate-700 flex flex-col h-full">
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="font-semibold text-white text-lg">{pigment.name}</h2>
              <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${status.bg} ${status.color}`}>
                <StatusIcon className="w-3 h-3" />
                {status.label}
              </div>
            </div>
            <p className="text-sm text-slate-400">{pigment.code}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-xl shadow-lg border-2 border-slate-600"
              style={{ backgroundColor: pigment.colorHex }}
            />
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">颜色代码</span>
                <div className="flex items-center gap-1">
                  <code className="text-sm font-mono text-slate-300">{pigment.colorHex}</code>
                  <button
                    onClick={() => navigator.clipboard.writeText(pigment.colorHex)}
                    className="p-1 hover:bg-slate-700 rounded"
                  >
                    <Copy className="w-3 h-3 text-slate-400" />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">成本</span>
                <span className="text-sm font-medium text-white">¥{pigment.cost}/kg</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-700/50 rounded-lg p-3">
              <div className="text-xs text-slate-400 mb-1">透明度</div>
              <div className="text-lg font-bold text-white">
                {(pigment.transparency * 100).toFixed(0)}%
              </div>
              <div className="mt-2 h-1.5 bg-slate-600 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all"
                  style={{ width: `${pigment.transparency * 100}%` }}
                />
              </div>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-3">
              <div className="text-xs text-slate-400 mb-1">耐光等级</div>
              <div className="text-lg font-bold text-white">
                {pigment.lightfastness ?? '未测'}
              </div>
              <div className="mt-2 h-1.5 bg-slate-600 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{ width: `${((pigment.lightfastness ?? 0) / 8) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {pigment.anomalies.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
              <div className="flex items-center gap-2 text-amber-500 mb-2">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm font-medium">异常标记</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {pigment.anomalies.map((a) => (
                  <span
                    key={a}
                    className="px-2 py-1 bg-amber-500/20 text-amber-400 text-xs rounded-md"
                  >
                    {ANOMALY_LABELS[a]}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="text-sm font-medium text-white mb-2">配方成分</h3>
            <div className="space-y-2">
              {pigment.formula.map((comp, i) => (
                <div key={i} className="bg-slate-700/50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-white">{comp.componentName}</span>
                    <span className="text-sm font-medium text-slate-300">{comp.ratio}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-600 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                      style={{ width: `${comp.ratio}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-slate-400">总计</span>
              <span className={`font-medium ${Math.abs(formulaTotal - 100) > 1 ? 'text-amber-500' : 'text-emerald-500'}`}>
                {formulaTotal.toFixed(1)}%
                {Math.abs(formulaTotal - 100) > 1 && ' ⚠️'}
              </span>
            </div>
          </div>

          {pigment.notes && (
            <div>
              <h3 className="text-sm font-medium text-white mb-2">备注</h3>
              <p className="text-sm text-slate-400 bg-slate-700/50 rounded-lg p-3">
                {pigment.notes}
              </p>
            </div>
          )}

          {pigment.status === 'pending' && (
            <div className="flex gap-2">
              <button
                onClick={() => updatePigmentStatus(pigment.id, 'processed')}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
                确认通过
              </button>
              <button
                onClick={() => updatePigmentStatus(pigment.id, 'rejected')}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <XCircle className="w-4 h-4" />
                退回补料
              </button>
            </div>
          )}

          <button
            onClick={() => setShowSchemeModal(true)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            添加到方案
          </button>
        </div>

        {similarPigments.length > 0 && (
          <div className="border-t border-slate-700 p-4">
            <h3 className="text-sm font-medium text-white mb-3">相似色料推荐</h3>
            <div className="space-y-2">
              {similarPigments.map((result) => (
                <button
                  key={result.pigment.id}
                  onClick={() => selectPigment(result.pigment.id)}
                  className="w-full flex items-center gap-3 p-3 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors text-left"
                >
                  <div
                    className="w-8 h-8 rounded-lg border border-slate-600"
                    style={{ backgroundColor: result.pigment.colorHex }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">
                      {result.pigment.name}
                    </div>
                    <div className="text-xs text-slate-400">{result.pigment.code}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-blue-400">
                      {(result.similarityScore * 100).toFixed(0)}%
                    </div>
                    <div className="text-xs text-slate-500">相似度</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {showSchemeModal && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
          <div className="bg-slate-800 rounded-xl p-4 w-72 shadow-xl border border-slate-700">
            <h3 className="font-semibold text-white mb-3">选择方案</h3>
            {schemes.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">暂无方案，请先创建方案</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {schemes.map((scheme) => (
                  <button
                    key={scheme.id}
                    onClick={() => {
                      addPigmentToScheme(scheme.id, pigment.id);
                      setShowSchemeModal(false);
                    }}
                    className="w-full text-left p-3 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    <div className="text-sm font-medium text-white">{scheme.name}</div>
                    <div className="text-xs text-slate-400">{scheme.pigmentIds.length} 个色料</div>
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => setShowSchemeModal(false)}
              className="w-full mt-3 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
