import { useState } from 'react';
import { Slider } from './Slider';
import { useDrumKitStore } from '@/store/useDrumKitStore';
import { DRUM_PIECE_NAMES, POLAR_PATTERN_NAMES, DISTANCE_UNIT_NAMES, MIC_MODEL_OPTIONS } from '@/utils/constants';
import { formatDistance } from '@/utils/acousticMath';
import { Mic, Trash2, Plus, ChevronDown, ChevronRight, AlertCircle, AlertTriangle, Info, Volume2 } from 'lucide-react';
import type { Microphone, DrumPiece, DistanceUnit, PolarPattern } from '@/types';

function MicItem({ mic, drumPiece }: { mic: Microphone; drumPiece?: DrumPiece }) {
  const { selectedMicId, selectMicrophone, updateMicrophone, removeMicrophone, analysis } = useDrumKitStore();
  const [isExpanded, setIsExpanded] = useState(selectedMicId === mic.id);
  
  const isSelected = selectedMicId === mic.id;
  const micErrors = analysis.errors.filter(e => e.sourceId === mic.id);
  const hasError = micErrors.some(e => e.severity === 'error');
  const hasWarning = micErrors.some(e => e.severity === 'warning');
  const hasInfo = micErrors.some(e => e.severity === 'info');
  
  const distance = drumPiece ? Math.sqrt(
    Math.pow(mic.position.x - drumPiece.position.x, 2) +
    Math.pow(mic.position.y - drumPiece.position.y, 2) +
    Math.pow(mic.position.z - drumPiece.position.z, 2)
  ) : 0;
  
  const StatusIcon = hasError ? AlertCircle : hasWarning ? AlertTriangle : hasInfo ? Info : null;
  const statusColor = hasError ? 'text-red-400' : hasWarning ? 'text-amber-400' : hasInfo ? 'text-blue-400' : 'text-green-400';
  
  return (
    <div className={`mb-2 rounded-lg border transition-all ${
      isSelected ? 'border-blue-500 bg-blue-900/20' : 'border-slate-700 bg-slate-800/50'
    }`}>
      <div
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-slate-700/50 rounded-lg"
        onClick={() => {
          selectMicrophone(isSelected ? null : mic.id);
          setIsExpanded(!isExpanded);
        }}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />}
          <Mic className={`w-4 h-4 flex-shrink-0 ${statusColor}`} />
          <span className="text-sm text-slate-200 truncate">{mic.name}</span>
          {StatusIcon && <StatusIcon className={`w-4 h-4 flex-shrink-0 ${statusColor}`} />}
        </div>
        <button
          className="p-1.5 hover:bg-red-900/50 rounded text-slate-400 hover:text-red-400 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            if (confirm(`确定删除麦克风「${mic.name}」吗？`)) {
              removeMicrophone(mic.id);
            }
          }}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      
      {isExpanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-slate-700 pt-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">麦克风名称</label>
            <input
              type="text"
              value={mic.name}
              onChange={(e) => updateMicrophone(mic.id, { name: e.target.value })}
              className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
            />
          </div>
          
          <div>
            <label className="block text-xs text-slate-400 mb-1">麦克风型号</label>
            <select
              value={mic.model || ''}
              onChange={(e) => updateMicrophone(mic.id, { model: e.target.value })}
              className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
            >
              {MIC_MODEL_OPTIONS.map(model => (
                <option key={model} value={model}>{model}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-xs text-slate-400 mb-1">极性模式</label>
            <select
              value={mic.polarPattern}
              onChange={(e) => updateMicrophone(mic.id, { polarPattern: e.target.value as PolarPattern })}
              className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
            >
              {Object.entries(POLAR_PATTERN_NAMES).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-xs text-slate-400 mb-1">距离单位</label>
            <select
              value={mic.distanceUnit}
              onChange={(e) => updateMicrophone(mic.id, { distanceUnit: e.target.value as DistanceUnit })}
              className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
            >
              {Object.entries(DISTANCE_UNIT_NAMES).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              到鼓件距离：<span className="text-blue-400">{drumPiece ? formatDistance(distance, mic.distanceUnit) : '-'}</span>
            </label>
          </div>
          
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              增益: {mic.gain > 0 ? '+' : ''}{mic.gain.toFixed(1)} dB
            </label>
            <Slider
              value={mic.gain}
              min={-30}
              max={30}
              step={0.5}
              onChange={(value) => updateMicrophone(mic.id, { gain: value })}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <label className="text-sm text-slate-400">相位反向</label>
            <button
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                mic.phaseInverted
                  ? 'bg-amber-500 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
              onClick={() => updateMicrophone(mic.id, { phaseInverted: !mic.phaseInverted })}
            >
              {mic.phaseInverted ? '已反向 180°' : '正常'}
            </button>
          </div>
          
          <div>
            <label className="block text-xs text-slate-400 mb-1">位置 X (米)</label>
            <input
              type="number"
              step="0.01"
              value={mic.position.x.toFixed(3)}
              onChange={(e) => {
                const value = parseFloat(e.target.value);
                if (!isNaN(value)) {
                  updateMicrophone(mic.id, { position: { ...mic.position, x: value } });
                }
              }}
              className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm text-slate-200 focus:border-blue-500 focus:outline-none font-mono"
            />
          </div>
          
          <div>
            <label className="block text-xs text-slate-400 mb-1">位置 Y (米)</label>
            <input
              type="number"
              step="0.01"
              value={mic.position.y.toFixed(3)}
              onChange={(e) => {
                const value = parseFloat(e.target.value);
                if (!isNaN(value)) {
                  updateMicrophone(mic.id, { position: { ...mic.position, y: value } });
                }
              }}
              className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm text-slate-200 focus:border-blue-500 focus:outline-none font-mono"
            />
          </div>
          
          <div>
            <label className="block text-xs text-slate-400 mb-1">位置 Z (米)</label>
            <input
              type="number"
              step="0.01"
              value={mic.position.z.toFixed(3)}
              onChange={(e) => {
                const value = parseFloat(e.target.value);
                if (!isNaN(value)) {
                  updateMicrophone(mic.id, { position: { ...mic.position, z: value } });
                }
              }}
              className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm text-slate-200 focus:border-blue-500 focus:outline-none font-mono"
            />
          </div>
          
          <div>
            <label className="block text-xs text-slate-400 mb-1">备注</label>
            <textarea
              value={mic.notes || ''}
              onChange={(e) => updateMicrophone(mic.id, { notes: e.target.value })}
              placeholder="输入拾音备注..."
              className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm text-slate-200 focus:border-blue-500 focus:outline-none resize-none h-16"
            />
          </div>
          
          {micErrors.length > 0 && (
            <div className="space-y-1">
              {micErrors.map((err) => (
                <div
                  key={err.id}
                  className={`p-2 rounded text-xs ${
                    err.severity === 'error' ? 'bg-red-900/30 border border-red-700 text-red-300' :
                    err.severity === 'warning' ? 'bg-amber-900/30 border border-amber-700 text-amber-300' :
                    'bg-blue-900/30 border border-blue-700 text-blue-300'
                  }`}
                >
                  <div className="font-medium">{err.message}</div>
                  <div className="text-[10px] opacity-80 mt-0.5">{err.suggestion}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DrumPieceItem({ piece }: { piece: DrumPiece }) {
  const { session, selectedDrumId, selectDrumPiece, addMicrophone, updateDrumPiece } = useDrumKitStore();
  const [isExpanded, setIsExpanded] = useState(selectedDrumId === piece.id);
  
  const isSelected = selectedDrumId === piece.id;
  const micsForPiece = session.microphones.filter(m => m.drumPieceId === piece.id);
  
  return (
    <div className={`mb-2 rounded-lg border transition-all ${
      isSelected ? 'border-blue-500 bg-blue-900/20' : 'border-slate-700 bg-slate-800/30'
    }`}>
      <div
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-slate-700/50 rounded-lg"
        onClick={() => {
          selectDrumPiece(isSelected ? null : piece.id);
          setIsExpanded(!isExpanded);
        }}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />}
          <span className="text-sm text-slate-300 truncate">{DRUM_PIECE_NAMES[piece.type]}</span>
          <span className="text-xs text-slate-500 flex-shrink-0">{micsForPiece.length}麦</span>
        </div>
        <button
          className="p-1.5 hover:bg-green-900/50 rounded text-slate-400 hover:text-green-400 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            addMicrophone(piece.id);
          }}
          title={`为${DRUM_PIECE_NAMES[piece.type]}添加麦克风`}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
      
      {isExpanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-slate-700 pt-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">鼓件名称</label>
            <input
              type="text"
              value={piece.name}
              onChange={(e) => updateDrumPiece(piece.id, { name: e.target.value })}
              className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
            />
          </div>
          
          <div>
            <label className="block text-xs text-slate-400 mb-1">尺寸规格</label>
            <div className="text-sm text-slate-300 font-mono">{piece.size}</div>
          </div>
          
          {micsForPiece.length > 0 && (
            <div>
              <label className="block text-xs text-slate-400 mb-2">关联麦克风</label>
              <div className="space-y-1">
                {micsForPiece.map(mic => (
                  <MicItem key={mic.id} mic={mic} drumPiece={piece} />
                ))}
              </div>
            </div>
          )}
          
          <div>
            <label className="block text-xs text-slate-400 mb-1">备注</label>
            <textarea
              value={piece.notes || ''}
              onChange={(e) => updateDrumPiece(piece.id, { notes: e.target.value })}
              placeholder="输入鼓件备注..."
              className="w-full px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm text-slate-200 focus:border-blue-500 focus:outline-none resize-none h-12"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function LeftPanel() {
  const { session, leftPanelOpen, toggleLeftPanel, setSessionName, setRecordingNotes } = useDrumKitStore();
  
  if (!leftPanelOpen) {
    return (
      <button
        onClick={toggleLeftPanel}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-20 bg-slate-800/90 hover:bg-slate-700 p-2 rounded-r-lg border-l-0 border border-slate-600 text-slate-300 hover:text-white transition-all"
        title="展开控制面板"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    );
  }
  
  return (
    <div className="absolute left-0 top-0 bottom-0 w-80 bg-slate-900/95 backdrop-blur-sm border-r border-slate-700 z-20 flex flex-col">
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-slate-100">鼓组拾音控制</h2>
          <button
            onClick={toggleLeftPanel}
            className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors"
            title="收起面板"
          >
            <ChevronDown className="w-4 h-4 rotate-90" />
          </button>
        </div>
        
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">方案名称</label>
            <input
              type="text"
              value={session.name}
              onChange={(e) => setSessionName(e.target.value)}
              className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
            />
          </div>
          
          <div>
            <label className="block text-xs text-slate-400 mb-1">录音备注</label>
            <textarea
              value={session.recordingNotes || ''}
              onChange={(e) => setRecordingNotes(e.target.value)}
              placeholder="输入整体录音备注，如：2024年秋季专辑录音、Jazz风格、暖色调..."
              className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200 focus:border-blue-500 focus:outline-none resize-none h-16"
            />
          </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex items-center gap-2 mb-3">
          <Volume2 className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-medium text-slate-300">鼓组配置</h3>
        </div>
        
        {session.drumPieces.map(piece => (
          <DrumPieceItem key={piece.id} piece={piece} />
        ))}
        
        {session.microphones.filter(m => !session.drumPieces.find(d => d.id === m.drumPieceId)).map(mic => (
          <div key={mic.id} className="mt-4">
            <div className="text-xs text-amber-400 mb-2">未关联鼓件的麦克风</div>
            <MicItem mic={mic} />
          </div>
        ))}
      </div>
      
      <div className="p-3 border-t border-slate-700 text-xs text-slate-500 text-center">
        提示：在3D视图中拖拽麦克风调整位置
      </div>
    </div>
  );
}
