import { useState } from 'react';
import { X, Check, XCircle, AlertTriangle, Clock, User, FileText, MapPin } from 'lucide-react';
import { OutdoorStall, ApprovalStatus } from '@/types';
import { useStore } from '@/store/useStore';
import StatusBadge from './StatusBadge';
import { formatDate } from '@/utils/timeUtils';

interface StallDetailModalProps {
  stall: OutdoorStall;
  onClose: () => void;
}

const sourceTypeLabels: Record<string, string> = {
  street_form: '街道表格',
  site_photo: '现场照片',
  approval_record: '审批记录',
  gis_legacy: 'GIS点位',
};

export default function StallDetailModal({ stall, onClose }: StallDetailModalProps) {
  const [remark, setRemark] = useState(stall.humanRemark || '');
  const updateStallStatus = useStore(state => state.updateStallStatus);

  const handleStatusUpdate = (status: ApprovalStatus) => {
    updateStallStatus(stall.id, status, remark);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{stall.name}</h2>
            <p className="text-sm text-gray-500 mt-1">{stall.location}</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                基本信息
              </h3>
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-500">审批状态</span>
                  <StatusBadge status={stall.status} />
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">外摆面积</span>
                  <span className="font-medium">{stall.area}㎡ / {stall.maxArea}㎡</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">经营时间</span>
                  <span className="font-medium">{stall.timePeriod}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">联系人</span>
                  <span className="font-medium">{stall.contact || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">联系电话</span>
                  <span className="font-medium">{stall.phone || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">创建时间</span>
                  <span className="text-sm">{formatDate(stall.createdAt)}</span>
                </div>
              </div>

              <h3 className="font-medium text-gray-900 flex items-center gap-2 mt-6">
                <MapPin className="w-4 h-4" />
                GIS坐标
              </h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600">
                  纬度: {stall.lat.toFixed(4)}, 经度: {stall.lng.toFixed(4)}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-medium text-gray-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                审批记录
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {stall.approvalRecords.map((record) => (
                  <div 
                    key={record.id} 
                    className={`p-3 rounded-lg border ${
                      record.result === 'pass' ? 'bg-green-50 border-green-200' :
                      record.result === 'warning' ? 'bg-yellow-50 border-yellow-200' :
                      'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-medium ${
                        record.result === 'pass' ? 'text-green-700' :
                        record.result === 'warning' ? 'text-yellow-700' :
                        'text-red-700'
                      }`}>
                        {record.type === 'capacity_check' ? '容量检测' :
                         record.type === 'time_conflict' ? '时间冲突检测' : '人工复核'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatDate(record.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">{record.description}</p>
                    <p className="text-xs text-gray-500 mt-1">操作人: {record.operator}</p>
                  </div>
                ))}
              </div>

              <h3 className="font-medium text-gray-900 flex items-center gap-2 mt-6">
                <FileText className="w-4 h-4" />
                数据来源
              </h3>
              <div className="space-y-2">
                {stall.sources.map((source) => (
                  <div key={source.id} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">
                        [{sourceTypeLabels[source.sourceType]}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatDate(source.importTime)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{source.sourceName}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <User className="w-4 h-4 inline mr-1" />
              人工备注
            </label>
            <textarea
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="请输入人工复核备注..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
              rows={3}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            取消
          </button>
          <button
            onClick={() => handleStatusUpdate('rejected')}
            className="px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
          >
            <XCircle className="w-4 h-4" />
            驳回
          </button>
          <button
            onClick={() => handleStatusUpdate('need_confirm')}
            className="px-4 py-2 text-white bg-yellow-600 rounded-lg hover:bg-yellow-700 transition-colors flex items-center gap-2"
          >
            <Clock className="w-4 h-4" />
            待确认
          </button>
          <button
            onClick={() => handleStatusUpdate('approved')}
            className="px-4 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            通过
          </button>
        </div>
      </div>
    </div>
  );
}
