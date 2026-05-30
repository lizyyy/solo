import { Plus, Trash2, Play, RotateCcw, Database } from 'lucide-react';
import { useStore } from '../store';
import { Speaker } from '../types';

export function SpeakerForm() {
  const {
    speakers,
    addSpeaker,
    updateSpeaker,
    removeSpeaker,
    calculate,
    loadDemoData,
    reset,
    isCalculating,
    versionMeta,
    setVersionMeta,
    splThreshold,
    setSplThreshold,
    frequency,
    setFrequency,
  } = useStore();

  const handleAddSpeaker = () => {
    addSpeaker({
      name: `音箱${speakers.length + 1}`,
      x: 0,
      y: 0,
      z: 2,
      power: 500,
      delay: 0,
      angle: 0,
      source: versionMeta.source,
      version: versionMeta.version,
    });
  };

  const handleSpeakerChange = (id: string, field: keyof Speaker, value: string | number) => {
    updateSpeaker(id, { [field]: value });
  };

  return (
    <div className="h-full flex flex-col bg-acoustic-800 rounded-lg overflow-hidden">
      <div className="p-4 border-b border-acoustic-700">
        <h2 className="text-lg font-semibold text-white mb-4">音箱参数设置</h2>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">版本号</label>
            <input
              type="text"
              value={versionMeta.version}
              onChange={(e) => setVersionMeta({ version: e.target.value })}
              className="w-full px-3 py-2 bg-acoustic-900 border border-acoustic-700 rounded text-white text-sm focus:outline-none focus:border-accent-primary"
              placeholder="1.0.0"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">数据来源</label>
            <input
              type="text"
              value={versionMeta.source}
              onChange={(e) => setVersionMeta({ source: e.target.value })}
              className="w-full px-3 py-2 bg-acoustic-900 border border-acoustic-700 rounded text-white text-sm focus:outline-none focus:border-accent-primary"
              placeholder="现场测量/系统设置"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">分析频率 (Hz)</label>
            <input
              type="number"
              value={frequency}
              onChange={(e) => setFrequency(Number(e.target.value))}
              className="w-full px-3 py-2 bg-acoustic-900 border border-acoustic-700 rounded text-white text-sm focus:outline-none focus:border-accent-primary font-mono"
              min="20"
              max="20000"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">声压阈值 (dB)</label>
            <input
              type="number"
              value={splThreshold}
              onChange={(e) => setSplThreshold(Number(e.target.value))}
              className="w-full px-3 py-2 bg-acoustic-900 border border-acoustic-700 rounded text-white text-sm focus:outline-none focus:border-accent-primary font-mono"
              min="60"
              max="140"
            />
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={handleAddSpeaker}
            className="flex items-center gap-2 px-3 py-2 bg-accent-primary text-white rounded hover:bg-cyan-500 transition-colors text-sm"
          >
            <Plus size={16} />
            添加音箱
          </button>
          <button
            onClick={calculate}
            disabled={speakers.length === 0 || isCalculating}
            className="flex items-center gap-2 px-3 py-2 bg-accent-success text-white rounded hover:bg-green-500 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play size={16} />
            {isCalculating ? '计算中...' : '开始计算'}
          </button>
          <button
            onClick={loadDemoData}
            className="flex items-center gap-2 px-3 py-2 bg-acoustic-700 text-white rounded hover:bg-acoustic-600 transition-colors text-sm"
          >
            <Database size={16} />
            加载演示
          </button>
          <button
            onClick={reset}
            className="flex items-center gap-2 px-3 py-2 bg-acoustic-700 text-white rounded hover:bg-acoustic-600 transition-colors text-sm"
          >
            <RotateCcw size={16} />
            重置
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {speakers.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p>暂无音箱数据</p>
            <p className="text-sm mt-2">点击"添加音箱"或"加载演示"开始</p>
          </div>
        ) : (
          <div className="space-y-4">
            {speakers.map((speaker, index) => (
              <div
                key={speaker.id}
                className="p-3 bg-acoustic-900 rounded-lg border border-acoustic-700"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-accent-primary/20 text-accent-primary text-xs flex items-center justify-center font-mono">
                      {index + 1}
                    </span>
                    <input
                      type="text"
                      value={speaker.name}
                      onChange={(e) => handleSpeakerChange(speaker.id, 'name', e.target.value)}
                      className="bg-transparent text-white font-medium text-sm focus:outline-none focus:border-b focus:border-accent-primary"
                    />
                  </div>
                  <button
                    onClick={() => removeSpeaker(speaker.id)}
                    className="p-1 text-gray-500 hover:text-accent-danger transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <label className="block text-gray-500 mb-1">X (m)</label>
                    <input
                      type="number"
                      value={speaker.x}
                      onChange={(e) => handleSpeakerChange(speaker.id, 'x', Number(e.target.value))}
                      className="w-full px-2 py-1.5 bg-acoustic-800 border border-acoustic-700 rounded text-white font-mono text-sm focus:outline-none focus:border-accent-primary"
                      step="0.1"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-500 mb-1">Y (m)</label>
                    <input
                      type="number"
                      value={speaker.y}
                      onChange={(e) => handleSpeakerChange(speaker.id, 'y', Number(e.target.value))}
                      className="w-full px-2 py-1.5 bg-acoustic-800 border border-acoustic-700 rounded text-white font-mono text-sm focus:outline-none focus:border-accent-primary"
                      step="0.1"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-500 mb-1">Z (m)</label>
                    <input
                      type="number"
                      value={speaker.z}
                      onChange={(e) => handleSpeakerChange(speaker.id, 'z', Number(e.target.value))}
                      className="w-full px-2 py-1.5 bg-acoustic-800 border border-acoustic-700 rounded text-white font-mono text-sm focus:outline-none focus:border-accent-primary"
                      step="0.1"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-500 mb-1">功率 (W)</label>
                    <input
                      type="number"
                      value={speaker.power}
                      onChange={(e) => handleSpeakerChange(speaker.id, 'power', Number(e.target.value))}
                      className="w-full px-2 py-1.5 bg-acoustic-800 border border-acoustic-700 rounded text-white font-mono text-sm focus:outline-none focus:border-accent-primary"
                      min="1"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-500 mb-1">延时 (ms)</label>
                    <input
                      type="number"
                      value={speaker.delay}
                      onChange={(e) => handleSpeakerChange(speaker.id, 'delay', Number(e.target.value))}
                      className="w-full px-2 py-1.5 bg-acoustic-800 border border-acoustic-700 rounded text-white font-mono text-sm focus:outline-none focus:border-accent-primary"
                      step="0.1"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-500 mb-1">角度 (°)</label>
                    <input
                      type="number"
                      value={speaker.angle}
                      onChange={(e) => handleSpeakerChange(speaker.id, 'angle', Number(e.target.value))}
                      className="w-full px-2 py-1.5 bg-acoustic-800 border border-acoustic-700 rounded text-white font-mono text-sm focus:outline-none focus:border-accent-primary"
                      step="1"
                      min="-180"
                      max="180"
                    />
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-acoustic-700 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="block text-gray-500 mb-1">来源</label>
                    <input
                      type="text"
                      value={speaker.source}
                      onChange={(e) => handleSpeakerChange(speaker.id, 'source', e.target.value)}
                      className="w-full px-2 py-1.5 bg-acoustic-800 border border-acoustic-700 rounded text-white text-sm focus:outline-none focus:border-accent-primary"
                      placeholder="数据来源"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-500 mb-1">版本</label>
                    <input
                      type="text"
                      value={speaker.version}
                      onChange={(e) => handleSpeakerChange(speaker.id, 'version', e.target.value)}
                      className="w-full px-2 py-1.5 bg-acoustic-800 border border-acoustic-700 rounded text-white text-sm focus:outline-none focus:border-accent-primary"
                      placeholder="版本号"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
