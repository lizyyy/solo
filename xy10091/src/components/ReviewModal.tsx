import { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { requestsApi } from '../api';

interface Props {
  type: 'approve' | 'reject' | 'abnormal' | 'ship';
  requestId: string;
  onClose: () => void;
  onSuccess: () => void;
}

const abnormalTypes = [
  { value: 'course', label: '完课记录异常' },
  { value: 'payment', label: '缴费异常' },
  { value: 'address', label: '邮寄地址异常' },
  { value: 'student', label: '学员信息异常' },
  { value: 'other', label: '其他异常' },
];

function ReviewModal({ type, requestId, onClose, onSuccess }: Props) {
  const [comment, setComment] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [abnormalType, setAbnormalType] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const titles = {
    approve: '审核通过',
    reject: '审核拒绝',
    abnormal: '标记异常',
    ship: '录入快递单号',
  };

  const handleSubmit = async () => {
    setError('');
    setLoading(true);

    try {
      switch (type) {
        case 'approve':
          await requestsApi.approve(requestId, {
            comment: comment.trim() || undefined,
            reviewerName: '审核员',
          });
          break;
        case 'reject':
          if (!comment.trim()) {
            setError('拒绝原因不能为空');
            setLoading(false);
            return;
          }
          await requestsApi.reject(requestId, {
            comment: comment.trim(),
            reviewerName: '审核员',
          });
          break;
        case 'abnormal':
          if (!abnormalType || !comment.trim()) {
            setError('请选择异常类型并填写异常原因');
            setLoading(false);
            return;
          }
          await requestsApi.markAbnormal(requestId, {
            abnormalType,
            abnormalReason: comment.trim(),
            reviewerName: '审核员',
          });
          break;
        case 'ship':
          if (!trackingNumber.trim()) {
            setError('快递单号不能为空');
            setLoading(false);
            return;
          }
          await requestsApi.ship(requestId, {
            trackingNumber: trackingNumber.trim(),
          });
          break;
      }
      onSuccess();
    } catch (e: any) {
      setError(e.response?.data?.error || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{titles[type]}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <span className="text-sm text-red-600">{error}</span>
            </div>
          )}

          {type === 'ship' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                快递单号 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="请输入快递单号"
                className="input"
              />
            </div>
          ) : (
            <>
              {type === 'abnormal' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    异常类型 <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={abnormalType}
                    onChange={(e) => setAbnormalType(e.target.value)}
                    className="input"
                  >
                    <option value="">请选择异常类型</option>
                    {abnormalTypes.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {type === 'approve' ? '审核意见（选填）' : type === 'reject' ? '拒绝原因' : '异常原因'}
                  {type !== 'approve' && <span className="text-red-500"> *</span>}
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={
                    type === 'approve'
                      ? '请输入审核意见（可选）'
                      : type === 'reject'
                      ? '请输入拒绝原因'
                      : '请详细描述异常原因'
                  }
                  rows={4}
                  className="input resize-none"
                />
              </div>
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
          <button onClick={onClose} className="btn-secondary" disabled={loading}>
            取消
          </button>
          <button
            onClick={handleSubmit}
            className={`${
              type === 'approve' ? 'btn-success' :
              type === 'reject' ? 'btn-danger' :
              type === 'abnormal' ? 'btn-warning' :
              'btn-primary'
            }`}
            disabled={loading}
          >
            {loading ? '提交中...' : '确认提交'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ReviewModal;
