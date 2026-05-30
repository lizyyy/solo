import { useDrumKitStore } from '@/store/useDrumKitStore';
import { ChevronDown, Activity, Waves, Thermometer, AlertTriangle, AlertCircle, Info, CheckCircle } from 'lucide-react';
import { getPhaseColor, getPhaseLabel, getCrosstalkColor, formatDistance } from '@/utils/acousticMath';
import { DRUM_PIECE_NAMES } from '@/utils/constants';

function PhaseInfo() {
  const { session, analysis, showPhaseLines, togglePhaseLines } = useDrumKitStore();
  
  const significantRelations = analysis.phaseRelations.filter(r => !r.isCoherent || r.phaseDiff > 20);
  
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Waves className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-medium text-slate-200">相位关系</h3>
        </div>
        <button
          onClick={togglePhaseLines}
          className={`px-2 py-1 rounded text-xs transition-colors ${
            showPhaseLines
              ? 'bg-amber-500 text-white'
              : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
          }`}
        >
          {showPhaseLines ? '显示连线' : '隐藏连线'}
        </button>
      </div>
      
      {significantRelations.length === 0 ? (
        <div className="bg-green-900/20 border border-green-800 rounded-lg p-3 text-center">
          <CheckCircle className="w-6 h-6 text-green-400 mx-auto mb-1" />
          <p className="text-sm text-green-300">所有麦克风相位一致</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {significantRelations.map((relation, index) => {
            const mic1 = session.microphones.find(m => m.id === relation.mic1Id);
            const mic2 = session.microphones.find(m => m.id === relation.mic2Id);
            if (!mic1 || !mic2) return null;
            
            const color = getPhaseColor(relation.phaseDiff);
            const label = getPhaseLabel(relation.phaseDiff);
            
            return (
              <div key={index} className="bg-slate-800/50 rounded-lg p-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-300 truncate max-w-[120px]">{mic1.name}</span>
                  <span className="text-slate-500">↔</span>
                  <span className="text-xs text-slate-300 truncate max-w-[120px]">{mic2.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-xs font-mono text-slate-400">
                    {relation.phaseDiff.toFixed(0)}°
                  </span>
                  <span className="text-xs text-slate-500">|</span>
                  <span className="text-xs" style={{ color }}>{label}</span>
                  <span className="text-xs text-slate-500 ml-auto">
                    相关度: {(relation.correlation * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CrosstalkMatrix() {
  const { session, analysis, showCrosstalk, toggleCrosstalk } = useDrumKitStore();
  
  const significantCrosstalk = analysis.crosstalkMatrix
    .filter(c => c.level > -40)
    .sort((a, b) => b.level - a.level)
    .slice(0, 10);
  
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Thermometer className="w-4 h-4 text-red-400" />
          <h3 className="text-sm font-medium text-slate-200">串音热力</h3>
        </div>
        <button
          onClick={toggleCrosstalk}
          className={`px-2 py-1 rounded text-xs transition-colors ${
            showCrosstalk
              ? 'bg-red-500 text-white'
              : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
          }`}
        >
          {showCrosstalk ? '显示热力' : '隐藏热力'}
        </button>
      </div>
      
      {significantCrosstalk.length === 0 ? (
        <div className="bg-green-900/20 border border-green-800 rounded-lg p-3 text-center">
          <CheckCircle className="w-6 h-6 text-green-400 mx-auto mb-1" />
          <p className="text-sm text-green-300">串音控制良好（均低于-40dB）</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {significantCrosstalk.map((data, index) => {
            const sourceMic = session.microphones.find(m => m.id === data.sourceMicId);
            const targetMic = session.microphones.find(m => m.id === data.targetMicId);
            if (!sourceMic || !targetMic) return null;
            
            const color = getCrosstalkColor(data.level);
            const severity = data.level > -20 ? '高' : data.level > -30 ? '中' : '低';
            
            return (
              <div key={index} className="bg-slate-800/50 rounded-lg p-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-400">串入</span>
                  <span className="text-xs text-slate-300 truncate max-w-[80px]">{targetMic.name}</span>
                </div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-400">来自</span>
                  <span className="text-xs text-slate-300 truncate max-w-[80px]">{sourceMic.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-xs font-mono text-slate-400">
                    {data.level.toFixed(1)} dB
                  </span>
                  <span className="text-xs text-slate-500">|</span>
                  <span className="text-xs" style={{ color }}>{severity}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatsCards() {
  const { session, analysis, selectedMicId } = useDrumKitStore();
  
  const selectedMic = session.microphones.find(m => m.id === selectedMicId);
  const selectedDrumPiece = selectedMic
    ? session.drumPieces.find(d => d.id === selectedMic.drumPieceId)
    : null;
  
  const distance = selectedMic && selectedDrumPiece
    ? Math.sqrt(
        Math.pow(selectedMic.position.x - selectedDrumPiece.position.x, 2) +
        Math.pow(selectedMic.position.y - selectedDrumPiece.position.y, 2) +
        Math.pow(selectedMic.position.z - selectedDrumPiece.position.z, 2)
      )
    : 0;
  
  const errorCount = analysis.errors.filter(e => e.severity === 'error').length;
  const warningCount = analysis.errors.filter(e => e.severity === 'warning').length;
  const infoCount = analysis.errors.filter(e => e.severity === 'info').length;
  
  const coherentCount = analysis.phaseRelations.filter(r => r.isCoherent).length;
  const totalPhaseRelations = analysis.phaseRelations.length;
  const phaseHealth = totalPhaseRelations > 0 ? (coherentCount / totalPhaseRelations) * 100 : 100;
  
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="w-4 h-4 text-blue-400" />
        <h3 className="text-sm font-medium text-slate-200">实时统计</h3>
      </div>
      
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-slate-800/50 rounded-lg p-2">
          <div className="text-xs text-slate-500">麦克风数量</div>
          <div className="text-lg font-bold text-slate-200">{session.microphones.length}</div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-2">
          <div className="text-xs text-slate-500">鼓件数量</div>
          <div className="text-lg font-bold text-slate-200">{session.drumPieces.length}</div>
        </div>
        <div className={`rounded-lg p-2 ${
          errorCount > 0 ? 'bg-red-900/30 border border-red-800' : 'bg-slate-800/50'
        }`}>
          <div className="text-xs text-slate-500">错误</div>
          <div className={`text-lg font-bold ${errorCount > 0 ? 'text-red-400' : 'text-slate-200'}`}>
            {errorCount}
          </div>
        </div>
        <div className={`rounded-lg p-2 ${
          warningCount > 0 ? 'bg-amber-900/30 border border-amber-800' : 'bg-slate-800/50'
        }`}>
          <div className="text-xs text-slate-500">警告</div>
          <div className={`text-lg font-bold ${warningCount > 0 ? 'text-amber-400' : 'text-slate-200'}`}>
            {warningCount}
          </div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-2 col-span-2">
          <div className="text-xs text-slate-500 mb-1">相位健康度</div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden mb-1">
            <div
              className={`h-full transition-all ${
                phaseHealth >= 80 ? 'bg-green-500' : phaseHealth >= 50 ? 'bg-amber-500' : 'bg-red-500'
              }`}
              style={{ width: `${phaseHealth}%` }}
            />
          </div>
          <div className="text-right text-xs text-slate-400">{phaseHealth.toFixed(0)}%</div>
        </div>
      </div>
      
      {selectedMic && (
        <div className="mt-3 bg-blue-900/20 border border-blue-800 rounded-lg p-3">
          <div className="text-xs text-blue-400 mb-1">选中麦克风</div>
          <div className="text-sm font-medium text-slate-200 mb-2">{selectedMic.name}</div>
          {selectedDrumPiece && (
            <div className="text-xs text-slate-400">
              <div>对应鼓件：{DRUM_PIECE_NAMES[selectedDrumPiece.type]}</div>
              <div>距离：{formatDistance(distance, selectedMic.distanceUnit)}</div>
              <div>增益：{selectedMic.gain > 0 ? '+' : ''}{selectedMic.gain} dB</div>
              <div>相位：{selectedMic.phaseInverted ? '已反向' : '正常'}</div>
            </div>
          )}
        </div>
      )}
      
      {infoCount > 0 && (
        <div className="mt-3 flex items-center gap-2 text-xs text-blue-400">
          <Info className="w-4 h-4" />
          <span>另有 {infoCount} 条提示信息</span>
        </div>
      )}
    </div>
  );
}

function ErrorList() {
  const { analysis } = useDrumKitStore();
  
  const errors = analysis.errors.filter(e => e.severity === 'error');
  const warnings = analysis.errors.filter(e => e.severity === 'warning');
  
  if (errors.length === 0 && warnings.length === 0) return null;
  
  const allItems = [...errors, ...warnings].slice(0, 8);
  
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-4 h-4 text-amber-400" />
        <h3 className="text-sm font-medium text-slate-200">问题与建议</h3>
      </div>
      
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {allItems.map(error => {
          const Icon = error.severity === 'error' ? AlertCircle : AlertTriangle;
          const bgColor = error.severity === 'error'
            ? 'bg-red-900/30 border-red-800'
            : 'bg-amber-900/30 border-amber-800';
          const textColor = error.severity === 'error' ? 'text-red-400' : 'text-amber-400';
          
          return (
            <div key={error.id} className={`${bgColor} border rounded-lg p-2`}>
              <div className="flex items-start gap-2">
                <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${textColor}`} />
                <div className="flex-1 min-w-0">
                  <div className={`text-xs font-medium ${textColor}`}>
                    {error.message}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    {error.suggestion}
                  </div>
                  {error.field && (
                    <div className="text-[10px] text-slate-500 mt-1 font-mono">
                      字段: {error.field}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function RightPanel() {
  const { rightPanelOpen, toggleRightPanel } = useDrumKitStore();
  
  if (!rightPanelOpen) {
    return (
      <button
        onClick={toggleRightPanel}
        className="absolute right-0 top-1/2 -translate-y-1/2 z-20 bg-slate-800/90 hover:bg-slate-700 p-2 rounded-l-lg border-r-0 border border-slate-600 text-slate-300 hover:text-white transition-all"
        title="展开信息面板"
      >
        <ChevronDown className="w-5 h-5 -rotate-90" />
      </button>
    );
  }
  
  return (
    <div className="absolute right-0 top-0 bottom-0 w-80 bg-slate-900/95 backdrop-blur-sm border-l border-slate-700 z-20 flex flex-col">
      <div className="p-4 border-b border-slate-700 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-100">拾音分析</h2>
        <button
          onClick={toggleRightPanel}
          className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors"
          title="收起面板"
        >
          <ChevronDown className="w-4 h-4 rotate-90" />
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4">
        <StatsCards />
        <PhaseInfo />
        <CrosstalkMatrix />
        <ErrorList />
      </div>
    </div>
  );
}
