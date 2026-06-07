import { useState } from 'react';
import { X, Upload } from 'lucide-react';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (data: {
    redLineNo: string;
    communityName: string;
    communityNameOld?: string;
    redLineRemark: string;
  }) => Promise<void>;
  loading: boolean;
}

export default function ImportModal({ isOpen, onClose, onImport, loading }: ImportModalProps) {
  const [redLineNo, setRedLineNo] = useState('');
  const [communityName, setCommunityName] = useState('');
  const [communityNameOld, setCommunityNameOld] = useState('');
  const [redLineRemark, setRedLineRemark] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onImport({
      redLineNo,
      communityName,
      communityNameOld: communityNameOld || undefined,
      redLineRemark,
    });
    setRedLineNo('');
    setCommunityName('');
    setCommunityNameOld('');
    setRedLineRemark('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">导入红线图备注</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                红线图编号 <span className="text-danger-500">*</span>
              </label>
              <input
                type="text"
                value={redLineNo}
                onChange={(e) => setRedLineNo(e.target.value)}
                placeholder="例如：HX-2024-005"
                className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-municipal-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                小区名称 <span className="text-danger-500">*</span>
              </label>
              <input
                type="text"
                value={communityName}
                onChange={(e) => setCommunityName(e.target.value)}
                placeholder="例如：阳光花园"
                className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-municipal-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              小区旧名称（如已知）
              <span className="text-slate-400 font-normal ml-1">
                系统不会自动归一化，将留给巡检员复核
              </span>
            </label>
            <input
              type="text"
              value={communityNameOld}
              onChange={(e) => setCommunityNameOld(e.target.value)}
              placeholder="例如：阳光小区"
              className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-municipal-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              红线图备注原文 <span className="text-danger-500">*</span>
              <span className="text-slate-400 font-normal ml-1">
                请完整粘贴原始备注，系统保留所有格式和内容
              </span>
            </label>
            <textarea
              value={redLineRemark}
              onChange={(e) => setRedLineRemark(e.target.value)}
              placeholder="完整粘贴红线图备注原文，包括所有换行、特殊符号、备注说明等..."
              rows={8}
              className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-municipal-500 focus:border-transparent font-mono text-sm"
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={loading}
            >
              取消
            </button>
            <button type="submit" className="btn-primary flex items-center gap-2" disabled={loading}>
              <Upload className="w-4 h-4" />
              {loading ? '导入中...' : '确认导入'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
