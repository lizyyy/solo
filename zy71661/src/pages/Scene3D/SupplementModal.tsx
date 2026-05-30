import { useState } from 'react';
import { useSimulationStore } from '@/store/useSimulationStore';
import { useUIStore } from '@/store/useUIStore';
import { X } from 'lucide-react';

const SAMPLE_SOURCES = ['学生', '设备', '口头'] as const;

export default function SupplementModal() {
  const { currentSimulation, supplementData } = useSimulationStore();
  const { showSupplementModal, supplementPointId, setShowSupplementModal } = useUIStore();

  const [velocity, setVelocity] = useState('');
  const [sampleSource, setSampleSource] = useState<string>('设备');
  const [recorder, setRecorder] = useState('');
  const [note, setNote] = useState('');

  if (!showSupplementModal || !supplementPointId) return null;

  const handleSave = () => {
    const measuredVelocity = parseFloat(velocity);
    if (isNaN(measuredVelocity)) return;
    supplementData(supplementPointId, {
      sample: {
        id: supplementPointId,
        measuredVelocity,
        measurementError: 0,
        sampleSource,
        sampledAt: new Date().toISOString(),
        recorder,
      },
      supplementSource: sampleSource,
    });
    setShowSupplementModal(false);
    setVelocity('');
    setSampleSource('设备');
    setRecorder('');
    setNote('');
  };

  const handleCancel = () => {
    setShowSupplementModal(false);
    setVelocity('');
    setSampleSource('设备');
    setRecorder('');
    setNote('');
  };

  const point = currentSimulation?.dataPoints.find(p => p.id === supplementPointId);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={handleCancel} />
      <div className="relative w-96 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <h3 className="text-white font-medium text-sm">数据补录</h3>
          <button onClick={handleCancel} className="text-gray-400 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        {point && (
          <div className="px-5 py-2 bg-gray-800/50 text-xs text-gray-400 font-mono">
            数据点: t={point.timestamp.toFixed(2)}s | 原速度={point.velocity.toFixed(2)} m/s
          </div>
        )}

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">速度 (实测) m/s</label>
            <input
              type="number"
              step="0.01"
              value={velocity}
              onChange={e => setVelocity(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm font-mono focus:outline-none focus:border-blue-500"
              placeholder="输入实测速度"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">采样来源</label>
            <select
              value={sampleSource}
              onChange={e => setSampleSource(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-blue-500"
            >
              {SAMPLE_SOURCES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">记录人</label>
            <input
              type="text"
              value={recorder}
              onChange={e => setRecorder(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-blue-500"
              placeholder="输入记录人姓名"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">备注</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-blue-500 resize-none"
              placeholder="补充说明（可选）"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-700">
          <button
            onClick={handleCancel}
            className="px-4 py-1.5 text-sm text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={!velocity || isNaN(parseFloat(velocity))}
            className="px-4 py-1.5 text-sm text-white bg-blue-600 hover:bg-blue-500 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
