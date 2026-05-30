import { useState, useEffect } from 'react';
import { Trash2, Play, FileText, Filter, X } from 'lucide-react';
import { useSchemeStore } from '../../store/useSchemeStore';
import { useSimulationStore } from '../../store/useSimulationStore';
import { presetSchemes } from '../../data/presets';
import { SimulationScheme } from '../../types';

export default function SchemePanel() {
  const { schemes, selectedSchemeId, filter, setFilter, selectScheme, removeScheme, loadSchemeToSimulation, addScheme, getFilteredSchemes } = useSchemeStore();
  const { setAttitude, setPressureReversed, resetSimulation } = useSimulationStore();
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    if (schemes.length === 0) {
      presetSchemes.forEach((scheme) => {
        addScheme(scheme);
      });
    }
  }, [schemes.length, addScheme]);

  const filteredSchemes = getFilteredSchemes();
  const selectedScheme = schemes.find((s) => s.id === selectedSchemeId);

  const handleLoadScheme = (scheme: SimulationScheme) => {
    loadSchemeToSimulation(scheme.id, setAttitude, setPressureReversed, resetSimulation);
  };

  const getConclusionBadge = (conclusion: string) => {
    switch (conclusion) {
      case 'consistent':
        return { text: '一致', color: 'bg-green-500/20 text-green-400 border-green-500/50' };
      case 'inconsistent':
        return { text: '不一致', color: 'bg-red-500/20 text-red-400 border-red-500/50' };
      case 'needs-evidence':
        return { text: '待补充', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50' };
      default:
        return { text: '未知', color: 'bg-gray-500/20 text-gray-400 border-gray-500/50' };
    }
  };

  const getEvidenceIcon = (type: string) => {
    switch (type) {
      case 'attitude-change':
        return '🔄';
      case 'pressure-calc':
        return '⚡';
      case 'trajectory-event':
        return '📍';
      case 'conclusion':
        return '📋';
      default:
        return '📝';
    }
  };

  return (
    <div className="w-80 bg-slate-900/95 backdrop-blur-md border-l border-slate-700/50 flex flex-col h-full">
      <div className="p-4 border-b border-slate-700/50">
        <h2 className="text-lg font-bold text-cyan-400 mb-1" style={{ fontFamily: 'Orbitron, sans-serif' }}>
          方案管理
        </h2>
        <p className="text-xs text-slate-400">保存和对比模拟方案</p>
      </div>

      <div className="p-3 border-b border-slate-700/50">
        <div className="flex items-center gap-1">
          <Filter size={14} className="text-slate-400" />
          {(['all', 'consistent', 'inconsistent'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2 py-1 text-xs rounded transition-all ${
                filter === f
                  ? 'bg-cyan-500 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {f === 'all' ? '全部' : f === 'consistent' ? '一致' : '不一致'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filteredSchemes.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <FileText size={40} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">暂无方案</p>
            <p className="text-xs">调整参数后保存方案</p>
          </div>
        ) : (
          filteredSchemes.map((scheme) => {
            const badge = getConclusionBadge(scheme.conclusion);
            const isSelected = selectedSchemeId === scheme.id;
            
            return (
              <div
                key={scheme.id}
                onClick={() => selectScheme(isSelected ? null : scheme.id)}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-cyan-500/10 border-cyan-500/50'
                    : 'bg-slate-800/50 border-slate-700/50 hover:border-slate-600'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-sm font-medium text-slate-200 truncate flex-1">
                    {scheme.name}
                  </h3>
                  <span className={`ml-2 px-2 py-0.5 text-xs rounded border ${badge.color}`}>
                    {badge.text}
                  </span>
                </div>
                
                <div className="text-xs text-slate-400 space-y-1">
                  <div className="flex justify-between">
                    <span>姿态:</span>
                    <span className="font-mono">
                      {scheme.attitude.alpha.toFixed(0)}° / {scheme.attitude.beta.toFixed(0)}°
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>轨迹点:</span>
                    <span>{scheme.trajectory.length} 个</span>
                  </div>
                  {scheme.hasUnitError && (
                    <div className="text-red-400">⚠️ 单位错误标记</div>
                  )}
                  {scheme.hasPressureReverse && (
                    <div className="text-orange-400">⚠️ 光压反向</div>
                  )}
                </div>

                {isSelected && (
                  <div className="mt-3 pt-3 border-t border-slate-700/50 flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLoadScheme(scheme);
                      }}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded bg-green-500 hover:bg-green-600 text-white text-xs font-medium transition-all"
                    >
                      <Play size={12} />
                      加载
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDetail(true);
                      }}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded bg-slate-600 hover:bg-slate-500 text-slate-200 text-xs font-medium transition-all"
                    >
                      <FileText size={12} />
                      详情
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('确定要删除此方案吗？')) {
                          removeScheme(scheme.id);
                        }
                      }}
                      className="p-1.5 rounded bg-red-500/20 hover:bg-red-500/40 text-red-400 transition-all"
                      title="删除方案"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {showDetail && selectedScheme && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-xl border border-slate-700 w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-lg font-bold text-cyan-400">方案详情 - {selectedScheme.name}</h3>
              <button
                onClick={() => setShowDetail(false)}
                className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-all"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-800/50 rounded-lg">
                  <h4 className="text-sm font-semibold text-slate-300 mb-2">姿态参数</h4>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">俯仰角 α:</span>
                      <span className="text-cyan-400 font-mono">{selectedScheme.attitude.alpha.toFixed(2)} {selectedScheme.attitude.unit === 'deg' ? '°' : 'rad'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">偏航角 β:</span>
                      <span className="text-cyan-400 font-mono">{selectedScheme.attitude.beta.toFixed(2)} {selectedScheme.attitude.unit === 'deg' ? '°' : 'rad'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">滚转角 γ:</span>
                      <span className="text-cyan-400 font-mono">{selectedScheme.attitude.gamma.toFixed(2)} {selectedScheme.attitude.unit === 'deg' ? '°' : 'rad'}</span>
                    </div>
                    {selectedScheme.hasUnitError && (
                      <div className="mt-2 p-2 bg-red-500/20 rounded text-red-400">
                        ⚠️ 检测到单位错误风险
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="p-3 bg-slate-800/50 rounded-lg">
                  <h4 className="text-sm font-semibold text-slate-300 mb-2">光压参数</h4>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">光压大小:</span>
                      <span className="text-orange-400 font-mono">{(selectedScheme.radiationPressure.magnitude * 1e6).toFixed(4)} μN</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">方向反向:</span>
                      <span className={selectedScheme.radiationPressure.isReversed ? 'text-red-400' : 'text-green-400'}>
                        {selectedScheme.radiationPressure.isReversed ? '是' : '否'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">轨迹点数:</span>
                      <span className="text-slate-200">{selectedScheme.trajectory.length}</span>
                    </div>
                    {selectedScheme.hasPressureReverse && (
                      <div className="mt-2 p-2 bg-orange-500/20 rounded text-orange-400">
                        ⚠️ 光压方向已反向
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-3 bg-slate-800/50 rounded-lg">
                <h4 className="text-sm font-semibold text-slate-300 mb-3">证据链时序</h4>
                <div className="space-y-2">
                  {selectedScheme.evidenceLog.map((item, index) => (
                    <div key={index} className="flex gap-3 text-xs">
                      <div className="flex flex-col items-center">
                        <span className="text-lg">{getEvidenceIcon(item.type)}</span>
                        {index < selectedScheme.evidenceLog.length - 1 && (
                          <div className="w-px h-full bg-slate-600 my-1" />
                        )}
                      </div>
                      <div className="flex-1 pb-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-slate-200 font-medium">{item.description}</span>
                          <span className="text-slate-500 font-mono">t={item.timestamp.toFixed(2)}s</span>
                        </div>
                        <div className="text-slate-400 text-[10px] bg-slate-700/50 p-2 rounded font-mono break-all">
                          {JSON.stringify(item.data, null, 0)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {selectedScheme.divergenceTime !== undefined && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <h4 className="text-sm font-semibold text-red-400 mb-2">异常事件记录</h4>
                  <div className="text-xs text-slate-300 space-y-1">
                    <div>轨迹发散时间: <span className="text-red-400 font-mono">{selectedScheme.divergenceTime.toFixed(2)}s</span></div>
                    <div className="text-slate-400 mt-2">
                      事件顺序：姿态错误 → 光压反向 → 轨迹发散 → 延迟到达
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-slate-700 flex justify-end gap-2">
              <button
                onClick={() => setShowDetail(false)}
                className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium transition-all"
              >
                关闭
              </button>
              <button
                onClick={() => {
                  handleLoadScheme(selectedScheme);
                  setShowDetail(false);
                }}
                className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-white text-sm font-medium transition-all"
              >
                加载此方案
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
