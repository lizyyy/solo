import { useState } from 'react';
import { X, Save, FileText, Calendar, MapPin } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

interface SaveSchemeDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SaveSchemeDialog = ({ isOpen, onClose }: SaveSchemeDialogProps) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { records, schemes, saveScheme } = useAppStore();

  const today = new Date().toISOString().slice(0, 10);
  const defaultName = `标注方案 ${today}`;

  if (!isOpen) return null;

  const handleSave = () => {
    const schemeName = name.trim() || defaultName;

    if (schemes.some(s => s.name === schemeName)) {
      setError('方案名称已存在，请使用其他名称');
      return;
    }

    saveScheme(schemeName, description.trim());
    onClose();
    setName('');
    setDescription('');
    setError(null);
  };

  const pendingCount = records.filter(r => r.status === 'pending').length;
  const processingCount = records.filter(r => r.status === 'processing').length;
  const completedCount = records.filter(r => r.status === 'completed').length;
  const confirmedCount = records.filter(r => r.status === 'confirmed').length;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="glass rounded-xl w-full max-w-md mx-4 overflow-hidden">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">保存标注方案</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4">
          <div className="bg-dark-800/50 rounded-lg p-4 mb-4">
            <p className="text-xs text-gray-400 mb-3">当前方案概览</p>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="bg-warning-500/10 rounded-lg p-2">
                <p className="text-lg font-bold text-warning-400">{pendingCount}</p>
                <p className="text-xs text-gray-500">待处理</p>
              </div>
              <div className="bg-primary-500/10 rounded-lg p-2">
                <p className="text-lg font-bold text-primary-400">{processingCount}</p>
                <p className="text-xs text-gray-500">处理中</p>
              </div>
              <div className="bg-success-500/10 rounded-lg p-2">
                <p className="text-lg font-bold text-success-400">{completedCount}</p>
                <p className="text-xs text-gray-500">已处理</p>
              </div>
              <div className="bg-dark-500/10 rounded-lg p-2">
                <p className="text-lg font-bold text-dark-400">{confirmedCount}</p>
                <p className="text-xs text-gray-500">已确认</p>
              </div>
            </div>
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-dark-600">
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <FileText className="w-3 h-3" />
                <span>共 {records.length} 条记录</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Calendar className="w-3 h-3" />
                <span>{today}</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <MapPin className="w-3 h-3" />
                <span>当前视角已保存</span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-300 block mb-2">
                方案名称 <span className="text-gray-500">(可选)</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={defaultName}
                className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-primary-500 transition-colors"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-300 block mb-2">
                方案描述 <span className="text-gray-500">(可选)</span>
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="例如：6月第二周巡检，包含3号风机叶片裂纹标注..."
                rows={3}
                className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-primary-500 transition-colors resize-none"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}
          </div>

          <div className="flex gap-3 justify-end mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-dark-600 hover:bg-dark-500 text-white text-sm transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 rounded-lg bg-success-600 hover:bg-success-500 text-white text-sm font-medium transition-colors flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              保存方案
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
