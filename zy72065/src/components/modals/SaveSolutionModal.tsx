import { useState } from 'react';
import { X, Save, RefreshCw, FileText } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { useFilteredPoints } from '../../hooks/useFilteredPoints';

interface SaveSolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SaveSolutionModal({ isOpen, onClose }: SaveSolutionModalProps) {
  const saveSolution = useStore((state) => state.saveSolution);
  const currentSolutionId = useStore((state) => state.currentSolutionId);
  const filteredPoints = useFilteredPoints();

  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [isRework, setIsRework] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!name.trim()) return;
    saveSolution(name, notes, isRework);
    setName('');
    setNotes('');
    setIsRework(false);
    onClose();
  };

  const warningCount = filteredPoints.filter((p) => p.status === 'warning').length;
  const dangerCount = filteredPoints.filter((p) => p.status === 'danger').length;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl max-w-md w-full">
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Save className="text-blue-500" size={20} />
            <h2 className="text-lg font-semibold text-white">保存处理方案</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-800 rounded text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <div className="text-blue-400 text-sm mb-2 flex items-center gap-2">
              <FileText size={14} />
              当前筛选摘要
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="text-center">
                <div className="text-white font-medium text-lg">{filteredPoints.length}</div>
                <div className="text-gray-400">总点位</div>
              </div>
              <div className="text-center">
                <div className="text-orange-400 font-medium text-lg">{warningCount}</div>
                <div className="text-gray-400">预警</div>
              </div>
              <div className="text-center">
                <div className="text-red-400 font-medium text-lg">{dangerCount}</div>
                <div className="text-gray-400">危险</div>
              </div>
            </div>
          </div>

          <div>
            <label className="text-sm text-gray-400 block mb-1">方案名称 *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：2024年5月中旬边坡预警处理方案"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="text-sm text-gray-400 block mb-1">备注说明</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="记录处理背景、关键判断依据等，便于后续交接..."
              rows={3}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          {currentSolutionId && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isRework}
                onChange={(e) => setIsRework(e.target.checked)}
                className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-purple-500 focus:ring-purple-500"
              />
              <span className="text-sm text-gray-300 flex items-center gap-1">
                <RefreshCw size={12} className="text-purple-400" />
                标记为返工版本（关联当前方案）
              </span>
            </label>
          )}

          <div className="p-3 bg-gray-800/30 rounded-lg">
            <p className="text-xs text-gray-500">
              &#128161; <span className="text-gray-400">提示：</span>
              保存方案会记录当前所有筛选条件和坐标系设置，
              下次加载时可一键恢复当前视图状态，方便周会评审时快速展示。
            </p>
          </div>
        </div>

        <div className="p-4 border-t border-gray-800 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm rounded transition-colors flex items-center gap-1"
          >
            <Save size={14} />
            保存方案
          </button>
        </div>
      </div>
    </div>
  );
}
