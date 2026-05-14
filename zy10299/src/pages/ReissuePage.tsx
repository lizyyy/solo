import React, { useState } from 'react';
import { Plus, Check, X, Eye, Unlock, AlertTriangle } from 'lucide-react';
import { useStore } from '../store/useStore';
import StatusBadge from '../components/StatusBadge';
import { ReissueRequest } from '../types';

type NewReissueRequest = Omit<ReissueRequest, 'id' | 'status' | 'createdAt'>;

const ReissuePage: React.FC = () => {
  const {
    getFilteredRequests,
    filterStatus,
    setFilterStatus,
    getStudentById,
    getAwardById,
    getCertificateById,
    getCompetitionById,
    approveRequest,
    rejectRequest,
    completeRequest,
    unblockRequest,
    setSelectedRequest,
    setShowModal,
    setModalType,
    students,
    certificates,
    awards,
    createReissueRequest
  } = useStore();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRequest, setNewRequest] = useState<NewReissueRequest>({
    studentId: '',
    certificateId: '',
    awardId: '',
    originalName: '',
    correctedName: '',
    reason: '',
    reasonCategory: 'name_error',
    receiver: '',
    receiverType: 'student',
    receiverPhone: '',
    classTeacherVerification: false
  });
  const [newCertificateNo, setNewCertificateNo] = useState('');
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completingRequestId, setCompletingRequestId] = useState('');

  const requests = getFilteredRequests();

  const handleStudentChange = (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    const studentCertificates = certificates.filter(c => c.studentId === studentId);
    const studentAwards = awards.filter(a => a.studentId === studentId);
    
    setNewRequest(prev => ({
      ...prev,
      studentId,
      originalName: student?.name || '',
      certificateId: studentCertificates[0]?.id || '',
      awardId: studentAwards[0]?.id || ''
    }));
  };

  const handleCreateRequest = () => {
    createReissueRequest(newRequest);
    setShowCreateModal(false);
    setNewRequest({
      studentId: '',
      certificateId: '',
      awardId: '',
      originalName: '',
      correctedName: '',
      reason: '',
      reasonCategory: 'name_error',
      receiver: '',
      receiverType: 'student',
      receiverPhone: '',
      classTeacherVerification: false
    });
  };

  const handleComplete = (requestId: string) => {
    const request = requests.find(r => r.id === requestId);
    if (request) {
      const oldCert = getCertificateById(request.certificateId);
      setNewCertificateNo(`${oldCert?.certificateNo}-R${String(Date.now()).slice(-4)}`);
      setCompletingRequestId(requestId);
      setShowCompleteModal(true);
    }
  };

  const handleConfirmComplete = () => {
    completeRequest(completingRequestId, newCertificateNo);
    setShowCompleteModal(false);
    setCompletingRequestId('');
  };

  const getRequestDetail = (request: ReissueRequest) => {
    const student = getStudentById(request.studentId);
    const award = getAwardById(request.awardId);
    const competition = award ? getCompetitionById(award.competitionId) : null;
    const oldCert = getCertificateById(request.certificateId);

    return { student, award, competition, oldCert };
  };

  const statusFilters = [
    { id: 'all', label: '全部' },
    { id: 'pending', label: '待处理' },
    { id: 'approved', label: '已批准' },
    { id: 'blocked', label: '已拦截' },
    { id: 'completed', label: '已完成' }
  ];

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">补发审批</h2>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            新建补发申请
          </button>
        </div>

        <div className="flex gap-2 mb-6">
          {statusFilters.map(filter => (
            <button
              key={filter.id}
              onClick={() => setFilterStatus(filter.id as any)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterStatus === filter.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {requests.map(request => {
            const { student, competition, oldCert } = getRequestDetail(request);
            return (
              <div
                key={request.id}
                className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-4">
                      <StatusBadge status={request.status} />
                      {request.status === 'blocked' && (
                        <span className="flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                          <AlertTriangle className="w-3 h-3" />
                          {request.blockerReason}
                        </span>
                      )}
                      <span className="text-sm text-gray-500">
                        申请日期: {request.createdAt}
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-6">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">学生信息</p>
                        <p className="font-medium">{request.originalName}</p>
                        <p className="text-sm text-gray-600">{student?.studentId}</p>
                        <p className="text-sm text-gray-600">{student?.className}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">竞赛奖项</p>
                        <p className="text-sm">{competition?.name}</p>
                        <p className="text-sm text-gray-600">{oldCert?.certificateNo}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">补发信息</p>
                        <p className="text-sm">{request.reason}</p>
                        {request.correctedName && (
                          <p className="text-sm text-blue-600">
                            更正姓名: {request.originalName} → {request.correctedName}
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">领取信息</p>
                        <p className="text-sm">领取人: {request.receiver}</p>
                        <p className="text-sm text-gray-600">
                          {request.receiverType === 'student' ? '学生本人' :
                           request.receiverType === 'class_teacher' ? '班主任代领' :
                           request.receiverType === 'parent' ? '家长代领' : '其他'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 ml-4">
                    {request.status === 'pending' && (
                      <>
                        <button
                          onClick={() => approveRequest(request.id)}
                          className="btn-success text-sm px-3 py-1.5 flex items-center gap-1"
                        >
                          <Check className="w-4 h-4" />
                          批准
                        </button>
                        <button
                          onClick={() => rejectRequest(request.id, '信息不完整')}
                          className="btn-danger text-sm px-3 py-1.5 flex items-center gap-1"
                        >
                          <X className="w-4 h-4" />
                          拒绝
                        </button>
                      </>
                    )}
                    {request.status === 'blocked' && (
                      <button
                        onClick={() => unblockRequest(request.id)}
                        className="btn-secondary text-sm px-3 py-1.5 flex items-center gap-1"
                      >
                        <Unlock className="w-4 h-4" />
                        解除拦截
                      </button>
                    )}
                    {request.status === 'approved' && (
                      <button
                        onClick={() => handleComplete(request.id)}
                        className="btn-primary text-sm px-3 py-1.5 flex items-center gap-1"
                      >
                        <Check className="w-4 h-4" />
                        完成补发
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setSelectedRequest(request);
                        setShowModal(true);
                        setModalType('detail');
                      }}
                      className="btn-secondary text-sm px-3 py-1.5 flex items-center gap-1"
                    >
                      <Eye className="w-4 h-4" />
                      详情
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 新建申请弹窗 */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">新建补发申请</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">选择学生</label>
                <select
                  value={newRequest.studentId}
                  onChange={(e) => handleStudentChange(e.target.value)}
                  className="select-field"
                >
                  <option value="">请选择学生</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>{s.name} - {s.studentId}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">选择证书</label>
                <select
                  value={newRequest.certificateId}
                  onChange={(e) => setNewRequest({ ...newRequest, certificateId: e.target.value })}
                  className="select-field"
                >
                  <option value="">请选择证书</option>
                  {certificates.filter(c => c.studentId === newRequest.studentId).map(c => (
                    <option key={c.id} value={c.id}>{c.certificateNo}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">更正后姓名（如需要）</label>
                <input
                  type="text"
                  value={newRequest.correctedName}
                  onChange={(e) => setNewRequest({ ...newRequest, correctedName: e.target.value })}
                  placeholder="如无需更正则留空"
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">补发原因类型</label>
                <select
                  value={newRequest.reasonCategory}
                  onChange={(e) => setNewRequest({ ...newRequest, reasonCategory: e.target.value as any })}
                  className="select-field"
                >
                  <option value="name_error">姓名错误</option>
                  <option value="lost">证书遗失</option>
                  <option value="damaged">证书损坏</option>
                  <option value="other">其他</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">补发原因说明</label>
                <textarea
                  value={newRequest.reason}
                  onChange={(e) => setNewRequest({ ...newRequest, reason: e.target.value })}
                  className="input-field"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">领取人</label>
                <input
                  type="text"
                  value={newRequest.receiver}
                  onChange={(e) => setNewRequest({ ...newRequest, receiver: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">领取人类型</label>
                <select
                  value={newRequest.receiverType}
                  onChange={(e) => setNewRequest({ ...newRequest, receiverType: e.target.value as any })}
                  className="select-field"
                >
                  <option value="student">学生本人</option>
                  <option value="class_teacher">班主任代领</option>
                  <option value="parent">家长代领</option>
                  <option value="teacher">老师代领</option>
                </select>
              </div>
              {newRequest.receiverType === 'class_teacher' && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="teacherVerify"
                    checked={newRequest.classTeacherVerification}
                    onChange={(e) => setNewRequest({ ...newRequest, classTeacherVerification: e.target.checked })}
                    className="w-4 h-4 text-blue-600"
                  />
                  <label htmlFor="teacherVerify" className="text-sm text-gray-700">
                    已核实班主任身份并登记
                  </label>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">联系电话</label>
                <input
                  type="text"
                  value={newRequest.receiverPhone}
                  onChange={(e) => setNewRequest({ ...newRequest, receiverPhone: e.target.value })}
                  className="input-field"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="btn-secondary"
              >
                取消
              </button>
              <button
                onClick={handleCreateRequest}
                className="btn-primary"
                disabled={!newRequest.studentId || !newRequest.certificateId || !newRequest.reason || !newRequest.receiver}
              >
                提交申请
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 完成补发弹窗 */}
      {showCompleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">完成补发</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">新证书编号</label>
                <input
                  type="text"
                  value={newCertificateNo}
                  onChange={(e) => setNewCertificateNo(e.target.value)}
                  className="input-field"
                />
              </div>
              <p className="text-sm text-gray-500">
                确认后，原证书将标记为无效，新证书将生效并记录到更正历史中。
              </p>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowCompleteModal(false)}
                className="btn-secondary"
              >
                取消
              </button>
              <button
                onClick={handleConfirmComplete}
                className="btn-primary"
              >
                确认完成
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReissuePage;
