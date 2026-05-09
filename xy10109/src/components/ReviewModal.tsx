import { useState } from 'react';
import type { Certificate, ReviewStatus } from '../types';
import { useAppContext } from '../context';
import { getTypeName, getStatusName, getDaysUntilExpiry } from '../utils';

interface Props {
  certificate: Certificate;
  onCancel: () => void;
}

export function ReviewModal({ certificate, onCancel }: Props) {
  const { reviewCertificate } = useAppContext();
  const [status, setStatus] = useState<ReviewStatus>(certificate.reviewStatus);
  const [comments, setComments] = useState(certificate.reviewComments || '');

  const handleSubmit = () => {
    reviewCertificate(certificate.id, status, comments.trim() || undefined);
    onCancel();
  };

  const daysUntil = getDaysUntilExpiry(certificate.expiryDate);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="text-lg font-semibold text-gray-800">人工复核</h3>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-500">证照名称</span>
              <span className="font-medium">{certificate.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">证照编号</span>
              <span className="font-mono text-sm">{certificate.certificateNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">证照类型</span>
              <span>{getTypeName(certificate.type)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">持证人/单位</span>
              <span>{certificate.holder}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">有效期</span>
              <span>{certificate.issueDate} 至 {certificate.expiryDate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">到期状态</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                certificate.status === 'expired' ? 'bg-red-100 text-red-800' :
                certificate.status === 'expiring_soon' ? 'bg-yellow-100 text-yellow-800' :
                'bg-green-100 text-green-800'
              }`}>
                {getStatusName(certificate.status)}
                {daysUntil >= 0 ? ` (${daysUntil}天后)` : ` (已过期${Math.abs(daysUntil)}天)`}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              复核状态
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'not_reviewed' as const, label: '未复核', color: 'orange' },
                { value: 'under_review' as const, label: '复核中', color: 'blue' },
                { value: 'approved' as const, label: '已通过', color: 'green' },
                { value: 'rejected' as const, label: '已驳回', color: 'red' },
              ].map(option => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setStatus(option.value)}
                  className={`p-3 rounded-lg border-2 transition ${
                    status === option.value
                      ? option.color === 'orange' ? 'border-orange-500 bg-orange-50' :
                        option.color === 'blue' ? 'border-blue-500 bg-blue-50' :
                        option.color === 'green' ? 'border-green-500 bg-green-50' :
                        'border-red-500 bg-red-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              复核备注
            </label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="请输入复核备注（可选）"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition"
            >
              取消
            </button>
            <button
              onClick={handleSubmit}
              className="flex-1 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
            >
              确认复核
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
