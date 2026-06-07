import { useState, useEffect } from 'react';
import { X, MessageSquare, User } from 'lucide-react';

interface RemarkDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (remark: string, operator: string) => void;
  recordCode?: string;
}

export const RemarkDialog = ({ isOpen, onClose, onSubmit, recordCode }: RemarkDialogProps) => {
  const [remark, setRemark] = useState('');
  const [operator, setOperator] = useState('何工');

  useEffect(() => {
    if (isOpen) {
      setRemark('');
      setOperator('何工');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (remark.trim()) {
      onSubmit(remark.trim(), operator.trim() || '何工');
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSubmit();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="glass rounded-xl p-6 max-w-md w-full shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary-400" />
            <h3 className="text-lg font-bold text-white">补录备注</h3>
            {recordCode && (
              <span className="text-xs font-mono text-gray-400 bg-dark-700 px-2 py-0.5 rounded">
                {recordCode}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="flex items-center gap-2 text-sm text-gray-400 mb-2">
              <User className="w-4 h-4" />
              操作人
            </label>
            <input
              type="text"
              value={operator}
              onChange={(e) => setOperator(e.target.value)}
              className="w-full px-3 py-2 bg-dark-800 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-primary-500 transition-colors"
              placeholder="请输入操作人姓名"
            />
          </div>

          <div>
            <label className="text-sm text-gray-400 mb-2 block">备注内容</label>
            <textarea
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full px-3 py-2 bg-dark-800 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-primary-500 transition-colors resize-none h-32"
              placeholder="请输入备注内容...&#10;&#10;例如：&#10;与上次巡检对比，裂纹长度增加2cm，需安排近期检修。&#10;已联系厂家，预计下周到货后更换。"
            />
            <p className="text-xs text-gray-500 mt-1">
              提示：按 Ctrl/Cmd + Enter 快速提交
            </p>
          </div>
        </div>

        <div className="flex gap-3 justify-end mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-dark-600 hover:bg-dark-500 text-white text-sm transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={!remark.trim()}
            className="px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-500 disabled:bg-primary-800 disabled:text-gray-400 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
          >
            确认提交
          </button>
        </div>
      </div>
    </div>
  );
};
