import { useState } from 'react';
import { X, Check, XCircle, Users } from 'lucide-react';

interface VerifyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (result: 'approved' | 'rejected', remark: string) => void;
  recordId: string;
  duplicateRecordIds?: string[];
}

export function VerifyModal({ isOpen, onClose, onSubmit, recordId, duplicateRecordIds }: VerifyModalProps) {
  const [result, setResult] = useState<'approved' | 'rejected' | null>(null);
  const [remark, setRemark] = useState('');

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (result) {
      onSubmit(result, remark.trim());
      setResult(null);
      setRemark('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
              <Users size={16} className="text-amber-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-800">标注负责人复核</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
            <p className="text-sm text-amber-800">
              <strong>提示：</strong>该记录被检测为疑似同一用户重复提交。请仔细核实后作出复核结论，不急着归为正常。
            </p>
            {duplicateRecordIds && duplicateRecordIds.length > 0 && (
              <p className="text-xs text-amber-700 mt-2">
                关联的疑似重复记录：{duplicateRecordIds.join('、')}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">复核结论</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setResult('approved')}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  result === 'approved'
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Check
                    size={18}
                    className={result === 'approved' ? 'text-emerald-600' : 'text-gray-400'}
                  />
                  <span
                    className={`font-medium ${
                      result === 'approved' ? 'text-emerald-700' : 'text-gray-700'
                    }`}
                  >
                    确认重复计入
                  </span>
                </div>
                <p className="text-xs text-gray-500">确认为同一用户重复反馈，合并处理</p>
              </button>
              <button
                onClick={() => setResult('rejected')}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  result === 'rejected'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <XCircle
                    size={18}
                    className={result === 'rejected' ? 'text-blue-600' : 'text-gray-400'}
                  />
                  <span
                    className={`font-medium ${
                      result === 'rejected' ? 'text-blue-700' : 'text-gray-700'
                    }`}
                  >
                    非重复，予以通过
                  </span>
                </div>
                <p className="text-xs text-gray-500">核实为不同事故，按正常流程处理</p>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">复核备注</label>
            <textarea
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="请输入复核说明，以便后续追溯..."
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={!result}
            className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-md hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            确认复核
          </button>
        </div>
      </div>
    </div>
  );
}
