import React, { useEffect, useState } from 'react';
import { X, Clock, AlertCircle, RotateCcw, FileText, Upload } from 'lucide-react';
import { ViolationRecord, Penalty, ProcessingHistory } from '../types';
import { getDriverName, getPenalties, rollbackPenalty, getAppealByViolationId } from '../services/violationService';
import { getHistory } from '../store/storage';
import { formatDateTime, getStatusText, getViolationTypeText, formatMoney } from '../utils/format';
import Timeline from './Timeline';
import RollbackModal from './RollbackModal';

interface ViolationDetailProps {
  violation: ViolationRecord;
  onClose: () => void;
  onRefresh: () => void;
}

const ViolationDetail: React.FC<ViolationDetailProps> = ({ violation, onClose, onRefresh }) => {
  const [histories, setHistories] = useState<ProcessingHistory[]>([]);
  const [penalty, setPenalty] = useState<Penalty | null>(null);
  const [appeal, setAppeal] = useState<any>(null);
  const [showRollback, setShowRollback] = useState(false);

  useEffect(() => {
    loadData();
  }, [violation.id]);

  const loadData = () => {
    const allHistories = getHistory();
    setHistories(allHistories.filter((h) => h.violationId === violation.id));

    const allPenalties = getPenalties();
    setPenalty(allPenalties.find((p) => p.violationId === violation.id) || null);

    setAppeal(getAppealByViolationId(violation.id));
  };

  const handleRollbackSuccess = () => {
    setShowRollback(false);
    onRefresh();
    loadData();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-100 p-2 rounded-lg">
              <AlertCircle className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">违章详情</h2>
              <p className="text-sm text-gray-500">{violation.violationNumber}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-500 mb-3 flex items-center">
                  <Clock className="w-4 h-4 mr-2" />
                  基本信息
                </h3>
                <dl className="grid grid-cols-2 gap-3">
                  <div>
                    <dt className="text-xs text-gray-500">车牌号</dt>
                    <dd className="text-sm font-medium text-gray-900">{violation.plateNumber}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">违章时间</dt>
                    <dd className="text-sm font-medium text-gray-900">{formatDateTime(violation.violationTime)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">违章类型</dt>
                    <dd className="text-sm font-medium text-gray-900">{getViolationTypeText(violation.violationType)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">违章地点</dt>
                    <dd className="text-sm font-medium text-gray-900">{violation.location}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">扣分</dt>
                    <dd className="text-sm font-medium text-red-600">{violation.points} 分</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">罚款金额</dt>
                    <dd className="text-sm font-medium text-orange-600">{formatMoney(violation.fineAmount)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">当前状态</dt>
                    <dd>
                      <span className={`status-badge status-${violation.status}`}>
                        {getStatusText(violation.status)}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">匹配司机</dt>
                    <dd className="text-sm font-medium text-gray-900">
                      {violation.matchedDriverId ? getDriverName(violation.matchedDriverId) : '未匹配'}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-500 mb-3 flex items-center">
                  <FileText className="w-4 h-4 mr-2" />
                  违章描述
                </h3>
                <p className="text-sm text-gray-700">{violation.description || '暂无描述'}</p>
              </div>

              {penalty && (
                <div className="bg-red-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-red-700 flex items-center">
                      <AlertCircle className="w-4 h-4 mr-2" />
                      处罚信息
                    </h3>
                    {!penalty.isRolledBack && (
                      <button
                        onClick={() => setShowRollback(true)}
                        className="text-sm text-red-600 hover:text-red-800 flex items-center"
                      >
                        <RotateCcw className="w-4 h-4 mr-1" />
                        回滚处罚
                      </button>
                    )}
                  </div>
                  <dl className="grid grid-cols-2 gap-3">
                    <div>
                      <dt className="text-xs text-gray-500">处罚时间</dt>
                      <dd className="text-sm font-medium text-gray-900">{formatDateTime(penalty.appliedAt)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-500">状态</dt>
                      <dd className="text-sm font-medium">
                        <span className={penalty.isRolledBack ? 'text-purple-600' : 'text-red-600'}>
                          {penalty.isRolledBack ? '已回滚' : '已执行'}
                        </span>
                      </dd>
                    </div>
                  </dl>
                  {penalty.isRolledBack && (
                    <div className="mt-3 pt-3 border-t border-red-200">
                      <div className="text-xs text-gray-500">回滚时间</div>
                      <div className="text-sm text-gray-900">{formatDateTime(penalty.rolledBackAt!)}</div>
                      <div className="text-xs text-gray-500 mt-2">回滚原因</div>
                      <div className="text-sm text-gray-700">{penalty.rollbackReason}</div>
                    </div>
                  )}
                </div>
              )}

              {appeal && (
                <div className="bg-orange-50 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-orange-700 mb-3 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-2" />
                    申诉信息
                  </h3>
                  <dl className="space-y-2">
                    <div>
                      <dt className="text-xs text-gray-500">申诉状态</dt>
                      <dd className="text-sm font-medium">
                        <span className={`status-badge status-${appeal.status === 'pending' ? 'pending_confirmation' : appeal.status === 'approved' ? 'appeal_approved' : 'appeal_rejected'}`}>
                          {appeal.status === 'pending' ? '待审核' : appeal.status === 'approved' ? '申诉通过' : '申诉驳回'}
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-500">申诉原因</dt>
                      <dd className="text-sm text-gray-700">{appeal.reason}</dd>
                    </div>
                    {appeal.reviewNotes && (
                      <div>
                        <dt className="text-xs text-gray-500">审核意见</dt>
                        <dd className="text-sm text-gray-700">{appeal.reviewNotes}</dd>
                      </div>
                    )}
                  </dl>
                </div>
              )}
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-3 flex items-center">
                <Clock className="w-4 h-4 mr-2" />
                处理时间线
              </h3>
              <Timeline histories={histories} />
            </div>
          </div>
        </div>

        <div className="flex justify-end p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            关闭
          </button>
        </div>
      </div>

      {showRollback && penalty && (
        <RollbackModal
          penalty={penalty}
          onClose={() => setShowRollback(false)}
          onSuccess={handleRollbackSuccess}
        />
      )}
    </div>
  );
};

export default ViolationDetail;
