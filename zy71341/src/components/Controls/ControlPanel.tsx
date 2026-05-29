import React, { useState } from 'react';
import { usePatternStore } from '@/store/patternStore';
import { usePlayerStore } from '@/store/playerStore';
import { useAudioEngine } from '@/hooks/useAudioEngine';
import { Play, Square, Metronome, Save, RefreshCw, GripVertical } from 'lucide-react';

export const ControlPanel: React.FC = () => {
  const { pattern, setBpm, setSteps, renamePattern, saveVersion, clearPattern } = usePatternStore();
  const { isPlaying, isMetronomeEnabled, toggleMetronome, initAudioContext } = usePlayerStore();
  const { togglePlayback } = useAudioEngine();
  const [saveMessage, setSaveMessage] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);

  const handlePlayClick = () => {
    initAudioContext();
    togglePlayback();
  };

  const handleSave = () => {
    if (saveMessage.trim()) {
      saveVersion(saveMessage);
      setSaveMessage('');
      setShowSaveInput(false);
    }
  };

  return (
    <div className="bg-dark-800 rounded-xl p-4 border border-dark-600">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-sm">名称:</span>
            <input
              type="text"
              value={pattern.name}
              onChange={(e) => renamePattern(e.target.value)}
              className="bg-dark-700 border border-dark-600 rounded px-2 py-1 text-sm w-40 focus:border-neon-blue outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <GripVertical size={16} className="text-gray-500" />
            <span className="text-gray-400 text-sm">BPM:</span>
            <input
              type="number"
              value={pattern.bpm}
              onChange={(e) => setBpm(Math.max(40, Math.min(300, Number(e.target.value))))}
              className="bg-dark-700 border border-dark-600 rounded px-2 py-1 text-sm w-16 text-center focus:border-neon-blue outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-sm">步数:</span>
            <select
              value={pattern.steps}
              onChange={(e) => setSteps(Number(e.target.value) as 16 | 32)}
              className="bg-dark-700 border border-dark-600 rounded px-2 py-1 text-sm focus:border-neon-blue outline-none"
            >
              <option value={16}>16 步</option>
              <option value={32}>32 步</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePlayClick}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
              isPlaying
                ? 'bg-neon-red text-white shadow-neon-red'
                : 'bg-neon-blue text-dark-900 shadow-neon-blue hover:shadow-lg'
            }`}
          >
            {isPlaying ? <Square size={18} /> : <Play size={18} />}
            {isPlaying ? '停止' : '播放'}
          </button>

          <button
            onClick={toggleMetronome}
            className={`p-2 rounded-lg transition-colors ${
              isMetronomeEnabled
                ? 'bg-neon-green text-dark-900'
                : 'bg-dark-700 text-gray-400 hover:text-white'
            }`}
            title={isMetronomeEnabled ? '关闭节拍器' : '开启节拍器'}
          >
            <Metronome size={18} />
          </button>

          {showSaveInput ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={saveMessage}
                onChange={(e) => setSaveMessage(e.target.value)}
                placeholder="版本说明..."
                className="bg-dark-700 border border-dark-600 rounded px-2 py-1 text-sm w-32 focus:border-neon-blue outline-none"
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                autoFocus
              />
              <button
                onClick={handleSave}
                className="p-2 bg-neon-green text-dark-900 rounded-lg hover:bg-opacity-80 transition-colors"
                title="确认保存"
              >
                <Save size={18} />
              </button>
              <button
                onClick={() => setShowSaveInput(false)}
                className="p-2 bg-dark-700 text-gray-400 rounded-lg hover:text-white transition-colors"
                title="取消"
              >
                <Square size={18} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowSaveInput(true)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                pattern.isDirty
                  ? 'bg-neon-orange text-white shadow-neon-orange'
                  : 'bg-dark-700 text-gray-400 hover:text-white'
              }`}
              title="保存版本"
            >
              <Save size={18} />
              {pattern.isDirty && <span className="w-2 h-2 bg-white rounded-full animate-pulse" />}
            </button>
          )}

          <button
            onClick={clearPattern}
            className="p-2 bg-dark-700 text-gray-400 rounded-lg hover:text-neon-red transition-colors"
            title="清空Pattern"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};
