import { useState } from 'react';
import { X, Save, FileText } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useSchemeStore } from '@/store/schemeStore';
import { useFormationStore } from '@/store/formationStore';

export function SaveModal() {
  const { showSaveModal, setShowSaveModal, cameraPosition, cameraTarget } = useUIStore();
  const { saveScheme } = useSchemeStore();
  const { drones, obstacles } = useFormationStore();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleSave = () => {
    if (!name.trim()) {
      alert('请输入方案名称');
      return;
    }

    saveScheme(name.trim(), description.trim(), drones, obstacles, {
      position: cameraPosition,
      target: cameraTarget,
    });

    alert('方案保存成功！');
    setShowSaveModal(false);
    setName('');
    setDescription('');
  };

  const handleClose = () => {
    setShowSaveModal(false);
    setName('');
    setDescription('');
  };

  if (!showSaveModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative w-full max-w-lg bg-[#0f1e36] border border-white/10 rounded-xl shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Save size={20} className="text-green-400" />
            保存方案
          </h2>
          <button
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-2 font-medium">
              方案名称 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：2026年6月第1周巡检"
              className="w-full px-3 py-2 bg-[#0a1628] border border-white/10 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 transition-colors"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-2 font-medium">
              方案描述
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="简要描述本次研判的内容和结论..."
              rows={4}
              className="w-full px-3 py-2 bg-[#0a1628] border border-white/10 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 resize-none transition-colors"
            />
          </div>

          <div className="p-4 bg-black/20 rounded-lg">
            <p className="text-xs text-gray-400 mb-2 flex items-center gap-2">
              <FileText size={12} className="text-blue-400" />
              方案内容预览
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="text-gray-500">无人机数量:</div>
              <div className="text-white font-mono">{drones.length} 架</div>
              <div className="text-gray-500">障碍物数量:</div>
              <div className="text-white font-mono">{obstacles.length} 个</div>
              <div className="text-gray-500">异常数量:</div>
              <div className="text-red-400 font-mono">
                {drones.filter((d) => d.status !== 'NORMAL').length} 条
              </div>
              <div className="text-gray-500">分析人员:</div>
              <div className="text-white">何工</div>
            </div>
          </div>

          <p className="text-[10px] text-gray-500">
            提示：方案将保存在本地浏览器中，包含所有无人机状态、处理备注和当前3D视角。
            后续可以随时加载继续处理。
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-white/10">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-xs text-gray-300 hover:bg-white/10 rounded-lg transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="px-4 py-2 text-xs text-white bg-green-500 hover:bg-green-600 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Save size={14} />
            确认保存
          </button>
        </div>
      </div>
    </div>
  );
}
