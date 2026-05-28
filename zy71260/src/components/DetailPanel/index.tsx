import { useState } from 'react';
import { X, Play, Pause, Volume2, Music, Info, AlertTriangle, AlertCircle, CheckCircle, Clock, FileText, Database, Link } from 'lucide-react';
import { useAppStore, useSelectedMode, useSelectedChord, useDataSource, useAudioSample } from '../../store/useAppStore';
import useAudio from '../../hooks/useAudio';
import { QUALITY_COLORS, CHORD_FUNCTION_COLORS } from '../../types';
import { getModeName, getQualityName, getChordFunctionName } from '../../utils/musicTheory';

const ValidationBadge = ({ type }: { type: 'warning' | 'error' | 'success' }) => {
  const config = {
    warning: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-400/10' },
    error: { icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-400/10' },
    success: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-400/10' },
  };
  const { icon: Icon, color, bg } = config[type];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded ${bg} ${color} text-xs`}>
      <Icon className="w-3 h-3" />
    </span>
  );
};

const SourceTimeline = ({ sourceId }: { sourceId: string }) => {
  const source = useDataSource(sourceId);
  const allSources = useAppStore((state) => state.dataSources);

  if (!source) return null;

  const stageColors: Record<string, string> = {
    raw: 'bg-slate-500',
    validated: 'bg-amber-500',
    cleaned: 'bg-cyan-500',
    final: 'bg-green-500',
  };

  const stageNames: Record<string, string> = {
    raw: '原始数据',
    validated: '已验证',
    cleaned: '已清洗',
    final: '最终版',
  };

  return (
    <div className="mt-4 p-3 bg-slate-800/50 rounded-lg">
      <div className="flex items-center gap-2 mb-3">
        <Database className="w-4 h-4 text-cyan-400" />
        <span className="text-sm font-medium text-slate-200">数据来源</span>
      </div>
      
      <div className="relative">
        <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-slate-700" />
        
        {allSources.sort((a, b) => a.processingOrder - b.processingOrder).map((s, index) => (
          <div key={s.id} className="relative flex items-start gap-3 pb-4 last:pb-0">
            <div className={`relative z-10 w-6 h-6 rounded-full ${s.id === sourceId ? stageColors[s.processingStage] : 'bg-slate-600'} flex items-center justify-center`}>
              {s.id === sourceId ? (
                <CheckCircle className="w-3 h-3 text-white" />
              ) : (
                <div className="w-2 h-2 rounded-full bg-slate-400" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className={`text-sm ${s.id === sourceId ? 'text-slate-100 font-medium' : 'text-slate-400'}`}>
                  {s.name}
                </span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${stageColors[s.processingStage]}/20 text-slate-300`}>
                  {stageNames[s.processingStage]}
                </span>
              </div>
              {s.id === sourceId && s.notes && (
                <p className="text-xs text-slate-400 mt-1">{s.notes}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const AudioPlayer = ({ sampleId, name, type = 'mode' }: { sampleId?: string; name: string; type?: 'mode' | 'chord' }) => {
  const sample = useAudioSample(sampleId);
  const { playSample, isPlaying, stop } = useAudio();
  const currentAudioId = useAppStore((state) => state.currentAudioId);

  if (!sample) return null;

  const isCurrentlyPlaying = isPlaying && currentAudioId === sample.id;

  const handlePlay = () => {
    if (isCurrentlyPlaying) {
      stop();
    } else {
      playSample(sample);
    }
  };

  return (
    <div className="mt-4 p-3 bg-slate-800/50 rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Music className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-medium text-slate-200">音频示例</span>
        </div>
        {sample.isMismatched && (
          <span className="flex items-center gap-1 text-xs text-red-400">
            <AlertTriangle className="w-3 h-3" />
            音频错配
          </span>
        )}
      </div>
      
      <div className="flex items-center gap-3">
        <button
          onClick={handlePlay}
          className="p-2 rounded-full bg-cyan-500 hover:bg-cyan-400 transition-colors"
        >
          {isCurrentlyPlaying ? (
            <Pause className="w-5 h-5 text-white" />
          ) : (
            <Play className="w-5 h-5 text-white ml-0.5" />
          )}
        </button>
        
        <div className="flex-1">
          <div className="text-xs text-slate-400 mb-1">
            {name} {type === 'chord' ? '和弦' : '音阶'}
          </div>
          <div className="flex items-center gap-1">
            {sample.notes.map((note, index) => (
              <div
                key={index}
                className={`flex-1 h-1.5 rounded ${isCurrentlyPlaying ? 'bg-cyan-400 animate-pulse' : 'bg-slate-600'}`}
                style={{ animationDelay: `${index * 0.1}s` }}
              />
            ))}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            音符: {sample.notes.join(' - ')}
          </div>
        </div>
      </div>
    </div>
  );
};

const ValidationSection = ({ validation }: { validation?: any }) => {
  if (!validation) return null;

  const { checks, warnings, errors } = validation;

  return (
    <div className="mt-4 p-3 bg-slate-800/50 rounded-lg">
      <div className="flex items-center gap-2 mb-3">
        <Info className="w-4 h-4 text-amber-400" />
        <span className="text-sm font-medium text-slate-200">验证结果</span>
      </div>
      
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">等音混淆:</span>
          <ValidationBadge type={checks.enharmonicConfusion ? 'warning' : 'success'} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">音频错配:</span>
          <ValidationBadge type={checks.audioMismatch ? 'error' : 'success'} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">路径断裂:</span>
          <ValidationBadge type={checks.brokenPath ? 'error' : 'success'} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">音程无效:</span>
          <ValidationBadge type={checks.invalidInterval ? 'error' : 'success'} />
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="space-y-1">
          {warnings.map((warning: string, index: number) => (
            <div key={index} className="flex items-start gap-2 text-xs text-amber-400">
              <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span>{warning}</span>
            </div>
          ))}
        </div>
      )}

      {errors.length > 0 && (
        <div className="space-y-1 mt-2">
          {errors.map((error: string, index: number) => (
            <div key={index} className="flex items-start gap-2 text-xs text-red-400">
              <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const ChordDetailView = ({ onClose }: { onClose: () => void }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const selectedChord = useSelectedChord();
  const modes = useAppStore((state) => state.modes);
  const setSelectedMode = useAppStore((state) => state.setSelectedMode);

  if (!selectedChord) return null;

  const parentMode = modes.find((m) => m.id === selectedChord.modeId);
  const chordColor = CHORD_FUNCTION_COLORS[selectedChord.function];

  if (isCollapsed) {
    return (
      <div className="fixed right-4 top-4 z-40">
        <button
          onClick={() => setIsCollapsed(false)}
          className="p-3 bg-slate-900/90 backdrop-blur-md rounded-xl border border-slate-700/50 hover:bg-slate-800/90 transition-colors"
          style={{ backgroundColor: chordColor + '30', borderColor: chordColor + '50' }}
        >
          <FileText className="w-5 h-5" style={{ color: chordColor }} />
        </button>
      </div>
    );
  }

  return (
    <div 
      className="fixed right-4 top-4 z-40 w-80 bg-slate-900/90 backdrop-blur-md rounded-xl border shadow-2xl overflow-hidden"
      style={{ borderColor: chordColor + '40' }}
    >
      <div 
        className="flex items-center justify-between p-4 border-b"
        style={{ backgroundColor: chordColor + '15', borderColor: chordColor + '30' }}
      >
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: chordColor + '30' }}
          >
            <Music className="w-5 h-5" style={{ color: chordColor }} />
          </div>
          <div>
            <h2 className="font-semibold text-slate-100">
              {selectedChord.symbol} 和弦
            </h2>
            <div className="flex items-center gap-2">
              <span 
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: QUALITY_COLORS[selectedChord.quality] }}
              />
              <span className="text-xs text-slate-400">
                {getQualityName(selectedChord.quality)}
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-slate-700/50 rounded transition-colors"
        >
          <X className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      <div className="p-4 max-h-[calc(100vh-180px)] overflow-y-auto custom-scrollbar">
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="p-3 bg-slate-800/50 rounded-lg text-center">
            <div className="text-sm font-semibold" style={{ color: chordColor }}>
              {getChordFunctionName(selectedChord.function)}
            </div>
            <div className="text-xs text-slate-400 mt-1">和弦功能</div>
          </div>
          <div className="p-3 bg-slate-800/50 rounded-lg text-center">
            <div className="text-sm font-semibold text-cyan-400">
              {selectedChord.name}
            </div>
            <div className="text-xs text-slate-400 mt-1">根音</div>
          </div>
        </div>

        {parentMode && (
          <button
            onClick={() => setSelectedMode(parentMode.id)}
            className="w-full flex items-center justify-between p-3 bg-slate-800/50 hover:bg-slate-700/50 rounded-lg transition-colors mb-4"
          >
            <div className="flex items-center gap-2">
              <Link className="w-4 h-4 text-cyan-400" />
              <span className="text-sm text-slate-300">所属调式</span>
            </div>
            <div className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: parentMode.color }}
              />
              <span className="text-sm text-slate-200">
                {getModeName(parentMode.rootNote, parentMode.type)}
              </span>
            </div>
          </button>
        )}

        <AudioPlayer 
          sampleId={selectedChord.audioSampleId} 
          name={selectedChord.symbol} 
          type="chord"
        />

        <ValidationSection validation={selectedChord.validation} />

        <SourceTimeline sourceId={selectedChord.sourceId} />
      </div>

      <button
        onClick={() => setIsCollapsed(true)}
        className="w-full py-2 border-t border-slate-700/50 text-xs text-slate-400 hover:text-slate-300 hover:bg-slate-800/30 transition-colors"
      >
        收起面板
      </button>
    </div>
  );
};

const ModeDetailView = ({ onClose }: { onClose: () => void }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const selectedMode = useSelectedMode();

  if (!selectedMode) return null;

  if (isCollapsed) {
    return (
      <div className="fixed right-4 top-4 z-40">
        <button
          onClick={() => setIsCollapsed(false)}
          className="p-3 bg-slate-900/90 backdrop-blur-md rounded-xl border border-slate-700/50 hover:bg-slate-800/90 transition-colors"
          style={{ backgroundColor: selectedMode.color + '30', borderColor: selectedMode.color + '50' }}
        >
          <FileText className="w-5 h-5" style={{ color: selectedMode.color }} />
        </button>
      </div>
    );
  }

  return (
    <div 
      className="fixed right-4 top-4 z-40 w-80 bg-slate-900/90 backdrop-blur-md rounded-xl border shadow-2xl overflow-hidden"
      style={{ borderColor: selectedMode.color + '40' }}
    >
      <div 
        className="flex items-center justify-between p-4 border-b"
        style={{ backgroundColor: selectedMode.color + '15', borderColor: selectedMode.color + '30' }}
      >
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ backgroundColor: selectedMode.color + '30' }}
          >
            <Music className="w-5 h-5" style={{ color: selectedMode.color }} />
          </div>
          <div>
            <h2 className="font-semibold text-slate-100">
              {getModeName(selectedMode.rootNote, selectedMode.type)}
            </h2>
            <div className="flex items-center gap-2">
              <span 
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: QUALITY_COLORS[selectedMode.quality] }}
              />
              <span className="text-xs text-slate-400">
                {getQualityName(selectedMode.quality)}
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-slate-700/50 rounded transition-colors"
        >
          <X className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      <div className="p-4 max-h-[calc(100vh-180px)] overflow-y-auto custom-scrollbar">
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="p-3 bg-slate-800/50 rounded-lg text-center">
            <div className="text-lg font-semibold text-cyan-400">{selectedMode.fifthsPosition}</div>
            <div className="text-xs text-slate-400">五度圈位置</div>
          </div>
          <div className="p-3 bg-slate-800/50 rounded-lg text-center">
            <div className="text-lg font-semibold text-purple-400">{selectedMode.functionLevel}</div>
            <div className="text-xs text-slate-400">功能层级</div>
          </div>
          <div className="p-3 bg-slate-800/50 rounded-lg text-center">
            <div className="text-lg font-semibold text-amber-400">{selectedMode.brightness}</div>
            <div className="text-xs text-slate-400">调式亮度</div>
          </div>
        </div>

        <AudioPlayer 
          sampleId={selectedMode.audioSampleId} 
          name={getModeName(selectedMode.rootNote, selectedMode.type)} 
          type="mode"
        />

        <ValidationSection validation={selectedMode.validation} />

        <SourceTimeline sourceId={selectedMode.sourceId} />
      </div>

      <button
        onClick={() => setIsCollapsed(true)}
        className="w-full py-2 border-t border-slate-700/50 text-xs text-slate-400 hover:text-slate-300 hover:bg-slate-800/30 transition-colors"
      >
        收起面板
      </button>
    </div>
  );
};

const DetailPanel = () => {
  const selectedMode = useSelectedMode();
  const selectedChord = useSelectedChord();
  const setSelectedMode = useAppStore((state) => state.setSelectedMode);
  const setSelectedChord = useAppStore((state) => state.setSelectedChord);

  if (!selectedMode && !selectedChord) {
    return (
      <div className="fixed right-4 top-4 z-40 w-72 bg-slate-900/90 backdrop-blur-md rounded-xl border border-slate-700/50 shadow-2xl p-6">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-3">
            <Info className="w-6 h-6 text-slate-500" />
          </div>
          <h3 className="text-slate-300 font-medium mb-2">选择元素查看详情</h3>
          <p className="text-sm text-slate-500">
            点击3D空间中的调式（球体）或和弦（八面体）节点，查看详细信息、试听音频示例和数据来源
          </p>
        </div>
      </div>
    );
  }

  if (selectedChord) {
    return <ChordDetailView onClose={() => setSelectedChord(null)} />;
  }

  return <ModeDetailView onClose={() => setSelectedMode(null)} />;
};

export default DetailPanel;
