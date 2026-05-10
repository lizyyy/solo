import { useEffect, useState } from 'react';
import { api } from '../api';
import type {
  LeaveRequest, LeaveStatus, Student, MeetingPoint, ApiError
} from '../types';

export default function LeavesPage() {
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [meetingPoints, setMeetingPoints] = useState<MeetingPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [showNewModal, setShowNewModal] = useState(false);
  const [newLeave, setNewLeave] = useState({
    studentId: '',
    meetingPointId: '',
    reason: '',
  });
  const [error, setError] = useState<ApiError | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [leavesData, studentsData, mpsData] = await Promise.all([
        api.getLeaves(),
        api.getStudents(),
        api.getMeetingPoints(),
      ]);
      setLeaves(leavesData);
      setStudents(studentsData);
      setMeetingPoints(mpsData);
    } catch (e) {
      console.error('加载数据失败', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(leaveId: string, approved: boolean) {
    try {
      setError(null);
      await api.approveLeave(leaveId, approved);
      setSuccess(approved ? '已批准请假' : '已拒绝请假');
      setTimeout(() => setSuccess(null), 2000);
      await loadData();
    } catch (e) {
      setError(e as ApiError);
    }
  }

  async function handleSubmitNew() {
    if (!newLeave.studentId || !newLeave.meetingPointId) {
      setError({ code: 'DATA_MISSING', message: '请选择学生和集合点' });
      return;
    }

    try {
      setError(null);
      await api.requestLeave({
        studentId: newLeave.studentId,
        meetingPointId: newLeave.meetingPointId,
        reason: newLeave.reason,
      });
      setSuccess('请假申请已提交');
      setShowNewModal(false);
      setNewLeave({ studentId: '', meetingPointId: '', reason: '' });
      setTimeout(() => setSuccess(null), 2000);
      await loadData();
    } catch (e) {
      setError(e as ApiError);
    }
  }

  const studentMap = new Map(students.map(s => [s.id, s]));
  const mpMap = new Map(meetingPoints.map(m => [m.id, m]));

  const filteredLeaves = leaves.filter(l => l.status === activeTab);

  function statusBadgeClass(s: LeaveStatus) {
    switch (s) {
      case 'pending': return 'badge-pending';
      case 'approved': return 'badge-approved';
      case 'rejected': return 'badge-rejected';
    }
  }

  function statusLabel(s: LeaveStatus) {
    switch (s) {
      case 'pending': return '待审批';
      case 'approved': return '已批准';
      case 'rejected': return '已拒绝';
    }
  }

  if (loading) {
    return <div className="loading"><div className="spinner"></div>加载中...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">请假审批</h1>
        <p className="page-subtitle">管理学生请假申请，审批后才能标记为请假状态</p>
      </div>

      {error && (
        <div className="error-message">
          <strong>错误 ({error.code})</strong>
          {error.message}
          {error.rawInput && (
            <div className="raw-input">原始输入：{error.rawInput}</div>
          )}
        </div>
      )}
      {success && <div className="success-message">{success}</div>}

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">请假申请</h2>
          <button className="btn btn-primary" onClick={() => setShowNewModal(true)}>
            + 新建请假申请
          </button>
        </div>

        <div className="tabs">
          <button
            className={`tab ${activeTab === 'pending' ? 'active' : ''}`}
            onClick={() => setActiveTab('pending')}
          >
            待审批 ({leaves.filter(l => l.status === 'pending').length})
          </button>
          <button
            className={`tab ${activeTab === 'approved' ? 'active' : ''}`}
            onClick={() => setActiveTab('approved')}
          >
            已批准 ({leaves.filter(l => l.status === 'approved').length})
          </button>
          <button
            className={`tab ${activeTab === 'rejected' ? 'active' : ''}`}
            onClick={() => setActiveTab('rejected')}
          >
            已拒绝 ({leaves.filter(l => l.status === 'rejected').length})
          </button>
        </div>

        {filteredLeaves.length > 0 ? (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>学生</th>
                  <th>集合点</th>
                  <th>请假原因</th>
                  <th>状态</th>
                  <th>申请时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeaves.map(leave => {
                  const student = studentMap.get(leave.studentId);
                  const mp = mpMap.get(leave.meetingPointId);
                  return (
                    <tr key={leave.id}>
                      <td>
                        <div className="student-row">
                          <span className="student-avatar">{student?.name?.[0] || '?'}</span>
                          {student?.name || '未知'}
                          <span style={{ color: '#6b7280', fontSize: '0.8rem', marginLeft: '0.5rem' }}>
                            {student?.studentId}
                          </span>
                        </div>
                      </td>
                      <td>{mp?.name || '未知'}</td>
                      <td>{leave.reason || '-'}</td>
                      <td>
                        <span className={`badge ${statusBadgeClass(leave.status)}`}>
                          {statusLabel(leave.status)}
                        </span>
                      </td>
                      <td>
                        {new Date(leave.requestTime).toLocaleString()}
                      </td>
                      <td>
                        {leave.status === 'pending' && (
                          <div className="btn-group">
                            <button
                              className="btn btn-success btn-sm"
                              onClick={() => handleApprove(leave.id, true)}
                            >
                              批准
                            </button>
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => handleApprove(leave.id, false)}
                            >
                              拒绝
                            </button>
                          </div>
                        )}
                        {leave.status !== 'pending' && (
                          <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>
                            审批人：{leave.approvedBy}<br />
                            审批时间：{leave.approvalTime ? new Date(leave.approvalTime).toLocaleString() : '-'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <p>暂无{statusLabel(activeTab)}的请假申请</p>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">业务规则</h2>
        </div>
        <div className="info-message">
          <ul style={{ marginLeft: '1.5rem' }}>
            <li>学生请假必须先提交申请，由老师审批</li>
            <li>只有<strong>已批准</strong>的请假，才能在点名时标记为"请假"状态</li>
            <li>未批准的请假直接点名会被系统拦截，并显示原始请求信息</li>
          </ul>
        </div>
      </div>

      {showNewModal && (
        <div className="modal-overlay" onClick={() => setShowNewModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">新建请假申请</h3>
              <button className="modal-close" onClick={() => setShowNewModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>选择学生</label>
                <select
                  value={newLeave.studentId}
                  onChange={e => setNewLeave({ ...newLeave, studentId: e.target.value })}
                >
                  <option value="">-- 请选择 --</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.studentId})</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>请假集合点</label>
                <select
                  value={newLeave.meetingPointId}
                  onChange={e => setNewLeave({ ...newLeave, meetingPointId: e.target.value })}
                >
                  <option value="">-- 请选择 --</option>
                  {meetingPoints.map(mp => (
                    <option key={mp.id} value={mp.id}>{mp.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>请假原因</label>
                <textarea
                  rows={3}
                  placeholder="请输入请假原因..."
                  value={newLeave.reason}
                  onChange={e => setNewLeave({ ...newLeave, reason: e.target.value })}
                ></textarea>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-outline"
                onClick={() => setShowNewModal(false)}
              >
                取消
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSubmitNew}
              >
                提交申请
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
