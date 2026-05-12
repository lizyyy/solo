import { useState } from 'react';
import { StoreType } from '../store/useStore';
import { Settings, Check, X, AlertTriangle, Download, MessageSquare } from 'lucide-react';

interface AdminPageProps {
  store: StoreType;
}

type TabType = 'reprint' | 'abnormal' | 'export';

const AdminPage = ({ store }: AdminPageProps) => {
  const { 
    state, 
    reviewReprintRequest, 
    resolveAbnormalRecord,
    exportData
  } = store;

  const [activeTab, setActiveTab] = useState<TabType>('reprint');
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [selectedAbnormal, setSelectedAbnormal] = useState<string | null>(null);
  const [resolutionText, setResolutionText] = useState('');

  const tabs = [
    { id: 'reprint', label: '补打审核', icon: Check },
    { id: 'abnormal', label: '异常记录', icon: AlertTriangle },
    { id: 'export', label: '数据导出', icon: Download },
  ];

  const pendingRequests = state.reprintRequests.filter(r => r.status === 'pending');
  const allRequests = state.reprintRequests;
  const pendingAbnormals = state.abnormalRecords.filter(r => r.status === 'pending');
  const allAbnormals = state.abnormalRecords;

  const handleApprove = (requestId: string) => {
    reviewReprintRequest(requestId, 'approve', reviewComment);
    setSelectedRequest(null);
    setReviewComment('');
  };

  const handleReject = (requestId: string) => {
    reviewReprintRequest(requestId, 'reject', reviewComment);
    setSelectedRequest(null);
    setReviewComment('');
  };

  const handleResolveAbnormal = (recordId: string) => {
    if (!resolutionText.trim()) {
      return;
    }
    resolveAbnormalRecord(recordId, resolutionText);
    setSelectedAbnormal(null);
    setResolutionText('');
  };

  const getAbnormalTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      code_invalid: '取片码无效',
      code_expired: '取片码过期',
      code_used: '取片码已使用',
      mismatch: '信息不匹配',
      printer_error: '打印机错误',
      other: '其他异常'
    };
    return labels[type] || type;
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="bg-purple-100 p-2 rounded-lg">
            <Settings className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">管理中心</h2>
            <p className="text-sm text-gray-500">审核补打申请、处理异常记录、导出数据</p>
          </div>
        </div>

        <div className="flex space-x-2 mb-6 overflow-x-auto">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            let badgeCount = 0;
            if (tab.id === 'reprint') badgeCount = pendingRequests.length;
            if (tab.id === 'abnormal') badgeCount = pendingAbnormals.length;
            
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
                {badgeCount > 0 && (
                  <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                    {badgeCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {activeTab === 'reprint' && (
          <div className="space-y-6">
            {pendingRequests.length > 0 && (
              <div>
                <h3 className="font-semibold text-gray-900 mb-4">待审核申请</h3>
                <div className="space-y-3">
                  {pendingRequests.map(request => {
                    const exam = state.exams.find(e => e.examNo === request.examNo);
                    const patient = state.patients.find(p => p.id === request.patientId);
                    
                    return (
                      <div key={request.id} className="border border-yellow-200 bg-yellow-50 rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <p className="font-medium text-gray-900">
                              {request.patientName}
                            </p>
                            <p className="text-sm text-gray-600">
                              检查号：<span className="font-mono">{request.examNo}</span>
                            </p>
                            {exam && (
                              <p className="text-sm text-gray-600">
                                检查类型：{exam.examType}（{exam.filmCount}张）
                              </p>
                            )}
                            <p className="text-sm text-gray-600">
                              补打原因：<span className="font-medium">{request.reason}</span>
                            </p>
                            <p className="text-sm text-gray-600">
                              申请人：{request.applicantName}
                            </p>
                            <p className="text-sm text-gray-600">
                              申请时间：{new Date(request.appliedAt).toLocaleString('zh-CN')}
                            </p>
                          </div>
                          <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full font-medium">
                            待审核
                          </span>
                        </div>

                        {selectedRequest === request.id ? (
                          <div className="mt-4 pt-4 border-t border-yellow-200 space-y-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                审核意见（可选）
                              </label>
                              <textarea
                                value={reviewComment}
                                onChange={(e) => setReviewComment(e.target.value)}
                                placeholder="请输入审核意见..."
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                rows={2}
                              />
                            </div>
                            <div className="flex space-x-3">
                              <button
                                onClick={() => handleApprove(request.id)}
                                className="flex-1 flex items-center justify-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors"
                              >
                                <Check className="h-4 w-4" />
                                <span>批准</span>
                              </button>
                              <button
                                onClick={() => handleReject(request.id)}
                                className="flex-1 flex items-center justify-center space-x-2 bg-red-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700 transition-colors"
                              >
                                <X className="h-4 w-4" />
                                <span>拒绝</span>
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedRequest(null);
                                  setReviewComment('');
                                }}
                                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-600 font-medium hover:bg-gray-50 transition-colors"
                              >
                                取消
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setSelectedRequest(request.id)}
                            className="mt-3 flex items-center space-x-2 text-purple-600 text-sm font-medium hover:text-purple-700"
                          >
                            <MessageSquare className="h-4 w-4" />
                            <span>审核</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {pendingRequests.length === 0 && (
              <div className="text-center py-8 bg-green-50 rounded-lg border border-green-200">
                <Check className="h-12 w-12 text-green-500 mx-auto mb-3" />
                <p className="text-green-800 font-medium">暂无待审核的补打申请</p>
              </div>
            )}

            <div>
              <h3 className="font-semibold text-gray-900 mb-4">全部补打申请</h3>
              {allRequests.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">患者</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">检查号</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">原因</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">申请人</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">申请时间</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">状态</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {allRequests.map(request => (
                        <tr key={request.id}>
                          <td className="px-4 py-3 text-gray-900">{request.patientName}</td>
                          <td className="px-4 py-3 font-mono text-gray-600">{request.examNo}</td>
                          <td className="px-4 py-3 text-gray-600">{request.reason}</td>
                          <td className="px-4 py-3 text-gray-600">{request.applicantName}</td>
                          <td className="px-4 py-3 text-gray-600">
                            {new Date(request.appliedAt).toLocaleString('zh-CN')}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              request.status === 'pending' 
                                ? 'bg-yellow-100 text-yellow-800'
                                : request.status === 'approved'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {request.status === 'pending' ? '待审核' : 
                               request.status === 'approved' ? '已批准' : '已拒绝'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">暂无补打申请记录</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'abnormal' && (
          <div className="space-y-6">
            {pendingAbnormals.length > 0 && (
              <div>
                <h3 className="font-semibold text-gray-900 mb-4">待处理异常</h3>
                <div className="space-y-3">
                  {pendingAbnormals.map(record => (
                    <div key={record.id} className="border border-red-200 bg-red-50 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <p className="font-medium text-gray-900">
                            {record.patientName}
                          </p>
                          <p className="text-sm text-gray-600">
                            类型：<span className="font-medium text-red-700">
                              {getAbnormalTypeLabel(record.type)}
                            </span>
                          </p>
                          {record.examNo && (
                            <p className="text-sm text-gray-600">
                              检查号：<span className="font-mono">{record.examNo}</span>
                            </p>
                          )}
                          {record.pickupCode && (
                            <p className="text-sm text-gray-600">
                              取片码：<span className="font-mono">{record.pickupCode}</span>
                            </p>
                          )}
                          <p className="text-sm text-gray-600">
                            描述：{record.description}
                          </p>
                          <p className="text-sm text-gray-600">
                            发生时间：{new Date(record.occurredAt).toLocaleString('zh-CN')}
                          </p>
                        </div>
                        <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full font-medium">
                          待处理
                        </span>
                      </div>

                      {selectedAbnormal === record.id ? (
                        <div className="mt-4 pt-4 border-t border-red-200 space-y-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              处理方案 <span className="text-red-500">*</span>
                            </label>
                            <textarea
                              value={resolutionText}
                              onChange={(e) => setResolutionText(e.target.value)}
                              placeholder="请输入处理方案..."
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                              rows={3}
                            />
                          </div>
                          <div className="flex space-x-3">
                            <button
                              onClick={() => handleResolveAbnormal(record.id)}
                              disabled={!resolutionText.trim()}
                              className="flex-1 flex items-center justify-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                            >
                              <Check className="h-4 w-4" />
                              <span>标记已处理</span>
                            </button>
                            <button
                              onClick={() => {
                                setSelectedAbnormal(null);
                                setResolutionText('');
                              }}
                              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-600 font-medium hover:bg-gray-50 transition-colors"
                            >
                              取消
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setSelectedAbnormal(record.id)}
                          className="mt-3 flex items-center space-x-2 text-purple-600 text-sm font-medium hover:text-purple-700"
                        >
                          <MessageSquare className="h-4 w-4" />
                          <span>处理</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {pendingAbnormals.length === 0 && (
              <div className="text-center py-8 bg-green-50 rounded-lg border border-green-200">
                <Check className="h-12 w-12 text-green-500 mx-auto mb-3" />
                <p className="text-green-800 font-medium">暂无待处理的异常记录</p>
              </div>
            )}

            <div>
              <h3 className="font-semibold text-gray-900 mb-4">全部异常记录</h3>
              {allAbnormals.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">患者</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">类型</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">描述</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">发生时间</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">状态</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {allAbnormals.map(record => (
                        <tr key={record.id}>
                          <td className="px-4 py-3 text-gray-900">{record.patientName || '-'}</td>
                          <td className="px-4 py-3 text-gray-600">{getAbnormalTypeLabel(record.type)}</td>
                          <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{record.description}</td>
                          <td className="px-4 py-3 text-gray-600">
                            {new Date(record.occurredAt).toLocaleString('zh-CN')}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              record.status === 'pending' 
                                ? 'bg-yellow-100 text-yellow-800'
                                : record.status === 'resolved'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {record.status === 'pending' ? '待处理' : 
                               record.status === 'resolved' ? '已处理' : '已忽略'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">暂无异常记录</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'export' && (
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900 mb-2">数据导出</h3>
            <p className="text-sm text-gray-500 mb-4">选择要导出的数据类型，系统将生成JSON格式文件</p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => exportData('print')}
                className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-left hover:bg-blue-100 transition-colors"
              >
                <div className="flex items-center space-x-3 mb-3">
                  <div className="bg-blue-500 p-2 rounded-lg">
                    <Download className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">打印记录</h4>
                    <p className="text-sm text-blue-600">{state.printRecords.length} 条记录</p>
                  </div>
                </div>
                <p className="text-sm text-gray-600">导出所有胶片打印记录</p>
              </button>

              <button
                onClick={() => exportData('reprint')}
                className="bg-green-50 border border-green-200 rounded-lg p-6 text-left hover:bg-green-100 transition-colors"
              >
                <div className="flex items-center space-x-3 mb-3">
                  <div className="bg-green-500 p-2 rounded-lg">
                    <Download className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">补打申请</h4>
                    <p className="text-sm text-green-600">{state.reprintRequests.length} 条记录</p>
                  </div>
                </div>
                <p className="text-sm text-gray-600">导出所有补打申请记录</p>
              </button>

              <button
                onClick={() => exportData('abnormal')}
                className="bg-red-50 border border-red-200 rounded-lg p-6 text-left hover:bg-red-100 transition-colors"
              >
                <div className="flex items-center space-x-3 mb-3">
                  <div className="bg-red-500 p-2 rounded-lg">
                    <Download className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">异常记录</h4>
                    <p className="text-sm text-red-600">{state.abnormalRecords.length} 条记录</p>
                  </div>
                </div>
                <p className="text-sm text-gray-600">导出所有异常记录</p>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPage;
