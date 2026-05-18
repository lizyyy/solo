import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useReturnStore } from '../store/returnStore';
import {
  ReturnStatus,
  ReturnStatusLabels,
  StatusTransition,
  DeviceTypeLabels,
  BatteryStatusLabels,
  DeviceConditionLabels,
  SubmitSourceLabels
} from '../../shared/types';
import { ArrowLeft, AlertTriangle, CheckCircle, Clock, User } from 'lucide-react';

export default function Review() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentApplication, fetchApplication, fetchTransitions, updateStatus, submitApplication, loading } = useReturnStore();

  const [allowedTransitions, setAllowedTransitions] = useState<StatusTransition[]>([]);
  const [reason, setReason] = useState('');
  const [showReasonInput, setShowReasonInput] = useState(false);
  const [selectedTransition, setSelectedTransition] = useState<StatusTransition | null>(null);

  useEffect(() => {
    if (id) {
      fetchApplication(id);
      fetchTransitions(id).then(setAllowedTransitions);
    }
  }, [id, fetchApplication, fetchTransitions]);

  const handleStatusChange = async (transition: StatusTransition) => {
    if (transition.requiresReason) {
      setSelectedTransition(transition);
      setShowReasonInput(true);
      return;
    }

    if (id) {
      const success = await updateStatus(id, transition.to as ReturnStatus);
      if (success) {
        fetchTransitions(id).then(setAllowedTransitions);
      }
    }
  };

  const confirmStatusChange = async () => {
    if (selectedTransition && id) {
      const success = await updateStatus(id, selectedTransition.to as ReturnStatus, reason);
      if (success) {
        fetchTransitions(id).then(setAllowedTransitions);
        setShowReasonInput(false);
        setReason('');
        setSelectedTransition(null);
      }
    }
  };

  const handleSubmit = async () => {
    if (id) {
      const success = await submitApplication(id);
      if (success) {
        fetchTransitions(id).then(setAllowedTransitions);
      }
    }
  };

  const getStatusColor = (status: ReturnStatus) => {
    const colors: Record<ReturnStatus, string> = {
      [ReturnStatus.DRAFT]: 'bg-gray-100 text-gray-800',
      [ReturnStatus.PENDING]: 'bg-yellow-100 text-yellow-800',
      [ReturnStatus.APPROVED]: 'bg-green-100 text-green-800',
      [ReturnStatus.REJECTED]: 'bg-red-100 text-red-800',
      [ReturnStatus.OWNERSHIP_ISSUE]: 'bg-orange-100 text-orange-800',
      [ReturnStatus.PROCESSING]: 'bg-blue-100 text-blue-800',
      [ReturnStatus.STORED]: 'bg-teal-100 text-teal-800',
      [ReturnStatus.COMPLETED]: 'bg-emerald-100 text-emerald-800',
      [ReturnStatus.ISSUE_RECORDED]: 'bg-purple-100 text-purple-800'
    };
    return colors[status];
  };

  if (!currentApplication) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-blue-900 text-white py-6 px-6">
        <div className="max-w-6xl mx-auto">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-blue-200 hover:text-white mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            返回列表
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">归还申请详情</h1>
              <p className="text-blue-200 mt-1">申请单号：{currentApplication.id}</p>
            </div>
            <span className={`px-4 py-2 rounded-full text-sm font-semibold ${getStatusColor(currentApplication.status)}`}>
              {ReturnStatusLabels[currentApplication.status]}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {currentApplication.status === ReturnStatus.DRAFT && (
          <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-xl p-6">
            <div className="flex items-start gap-4">
              <AlertTriangle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-medium text-yellow-800 mb-1">草稿状态</h3>
                <p className="text-yellow-700 text-sm mb-4">当前申请为草稿状态，请确认信息无误后提交审核。</p>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50"
                >
                  提交审核
                </button>
              </div>
            </div>
          </div>
        )}

        {currentApplication.validationIssues.length > 0 && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-6">
            <div className="flex items-start gap-4">
              <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-medium text-red-800 mb-3">检测到 {currentApplication.validationIssues.length} 个问题</h3>
                <div className="space-y-2">
                  {currentApplication.validationIssues.map((issue, index) => (
                    <div key={index} className="flex items-start gap-2 text-sm text-red-700">
                      <span className="w-1.5 h-1.5 bg-red-500 rounded-full mt-1.5 flex-shrink-0"></span>
                      {issue.deviceId && <span className="font-mono">[{issue.deviceId}]</span>}
                      {issue.message}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {allowedTransitions.length > 0 && !showReasonInput && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-6">
            <h3 className="font-medium text-blue-800 mb-4">可执行操作</h3>
            <div className="flex flex-wrap gap-3">
              {allowedTransitions.map((transition, index) => (
                <button
                  key={index}
                  onClick={() => handleStatusChange(transition)}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {transition.action}
                </button>
              ))}
            </div>
          </div>
        )}

        {showReasonInput && selectedTransition && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-6">
            <h3 className="font-medium text-blue-800 mb-4">执行操作：{selectedTransition.action}</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">原因说明 *</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="请输入原因说明..."
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={confirmStatusChange}
                disabled={!reason || loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                确认
              </button>
              <button
                onClick={() => {
                  setShowReasonInput(false);
                  setReason('');
                  setSelectedTransition(null);
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-800">基本信息</h2>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm text-gray-500 mb-1">讲解组名称</label>
                  <p className="text-gray-900 font-medium">{currentApplication.teamName}</p>
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-1">负责人</label>
                  <p className="text-gray-900 font-medium">{currentApplication.responsiblePerson}</p>
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-1">联系电话</label>
                  <p className="text-gray-900 font-medium">{currentApplication.phone}</p>
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-1">归还日期</label>
                  <p className="text-gray-900 font-medium">{currentApplication.returnDate}</p>
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-1">提交来源</label>
                  <p className="text-gray-900 font-medium">{SubmitSourceLabels[currentApplication.submitSource]}</p>
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-1">设备数量</label>
                  <p className="text-gray-900 font-medium">{currentApplication.deviceCount} 台</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-800">设备清单</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">设备编号</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">类型</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">电量</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">借出团队</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">备注</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {currentApplication.devices.map((device, index) => (
                      <tr key={index} className={device.borrowTeam !== currentApplication.teamName ? 'bg-orange-50' : ''}>
                        <td className="px-6 py-4 whitespace-nowrap font-mono text-sm text-blue-600">{device.deviceId}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{DeviceTypeLabels[device.deviceType]}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{BatteryStatusLabels[device.batteryStatus]}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={device.borrowTeam !== currentApplication.teamName ? 'text-orange-600 font-medium' : 'text-gray-900'}>
                            {device.borrowTeam}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            device.condition === 'normal' ? 'bg-green-100 text-green-800' :
                            device.condition === 'damaged' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {DeviceConditionLabels[device.condition]}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">{device.remarks || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  操作日志
                </h2>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {currentApplication.operationLogs.map((log, index) => (
                    <div key={index} className="relative pl-6 pb-4 border-l-2 border-gray-200 last:border-0 last:pb-0">
                      <div className="absolute left-0 top-0 w-3 h-3 bg-gray-300 rounded-full -translate-x-1.5"></div>
                      <p className="font-medium text-gray-900">{log.action}</p>
                      <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {log.operator}
                      </p>
                      <p className="text-sm text-gray-400 mt-1">{new Date(log.time).toLocaleString('zh-CN')}</p>
                      {log.remarks && (
                        <p className="text-sm text-gray-600 mt-2 bg-gray-50 p-2 rounded">{log.remarks}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  状态流转说明
                </h2>
              </div>
              <div className="p-6">
                <div className="space-y-2 text-sm text-gray-600">
                  <p>• <span className="font-medium">草稿</span> → 提交后进入待审核</p>
                  <p>• <span className="font-medium">待审核</span> → 可通过、驳回或标记归属问题</p>
                  <p>• <span className="font-medium">归属不清</span> → 进入处理流程</p>
                  <p>• <span className="font-medium">处理中</span> → 问题解决后通过，或记录问题</p>
                  <p>• <span className="font-medium">审核通过</span> → 设备入库</p>
                  <p>• <span className="font-medium">设备入库</span> → 流程完成</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
