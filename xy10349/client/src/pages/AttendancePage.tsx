import { useEffect, useState } from 'react';
import { api } from '../api';
import type { Student, MeetingPoint, Group, AttendanceStatus, ApiError } from '../types';

export default function AttendancePage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [meetingPoints, setMeetingPoints] = useState<MeetingPoint[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMeetingPoint, setSelectedMeetingPoint] = useState<string>('');
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState<ApiError | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<{ studentName: string; status: string } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [studentsData, mpsData, groupsData] = await Promise.all([
        api.getStudents(),
        api.getMeetingPoints(),
        api.getGroups(),
      ]);
      setStudents(studentsData);
      setMeetingPoints(mpsData);
      setGroups(groupsData);
      if (mpsData.length > 0 && !selectedMeetingPoint) {
        setSelectedMeetingPoint(mpsData[0].id);
      }
    } catch (e) {
      console.error('加载数据失败', e);
    } finally {
      setLoading(false);
    }
  }

  async function recordStatus(studentId: string, studentName: string, status: AttendanceStatus) {
    if (!selectedMeetingPoint) {
      setError({ code: 'DATA_MISSING', message: '请先选择集合点' });
      return;
    }

    try {
      setError(null);
      await api.recordAttendance({
        studentId,
        meetingPointId: selectedMeetingPoint,
        status,
      });
      setSuccess(`${studentName} 标记成功`);
      setLastAction({ studentName, status });
      setTimeout(() => {
        setSuccess(null);
        setLastAction(null);
      }, 2000);
    } catch (e) {
      setError(e as ApiError);
    }
  }

  const groupMap = new Map(groups.map(g => [g.id, g]));
  const mpMap = new Map(meetingPoints.map(m => [m.id, m]));

  const filteredStudents = students.filter(s => {
    const matchesSearch = s.name.includes(search) || s.studentId.includes(search);
    const matchesGroup = !selectedGroup || s.groupId === selectedGroup;
    return matchesSearch && matchesGroup;
  });

  function statusLabel(s: AttendanceStatus): string {
    switch (s) {
      case 'present': return '到岗';
      case 'absent': return '缺勤';
      case 'leave': return '请假';
      case 'late': return '迟到';
    }
  }

  if (loading) {
    return <div className="loading"><div className="spinner"></div>加载中...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">点名</h1>
        <p className="page-subtitle">在各集合点进行点名登记。系统会自动拦截违规操作</p>
      </div>

      {error && (
        <div className="error-message">
          <strong>操作被拦截 ({error.code})</strong>
          {error.message}
          {error.rawInput && (
            <div className="raw-input">原始请求：{error.rawInput}</div>
          )}
          {error.details && (
            <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
              详情：{JSON.stringify(error.details)}
            </div>
          )}
        </div>
      )}
      {success && <div className="success-message">{success}</div>}

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">选择点名位置</h2>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>集合点</label>
            <select
              value={selectedMeetingPoint}
              onChange={e => setSelectedMeetingPoint(e.target.value)}
            >
              {meetingPoints.map(mp => (
                <option key={mp.id} value={mp.id}>{mp.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>筛选小组</label>
            <select
              value={selectedGroup}
              onChange={e => setSelectedGroup(e.target.value)}
            >
              <option value="">全部小组</option>
              {groups.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>搜索学生</label>
            <input
              type="text"
              placeholder="姓名或学号..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
        {selectedMeetingPoint && mpMap.get(selectedMeetingPoint) && (
          <div className="info-message mt-2">
            <strong>{mpMap.get(selectedMeetingPoint)!.name}</strong>
            {' - '}{mpMap.get(selectedMeetingPoint)!.location}
            {mpMap.get(selectedMeetingPoint)!.description && (
              <> · {mpMap.get(selectedMeetingPoint)!.description}</>
            )}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">学生点名 ({filteredStudents.length} 人)</h2>
          {lastAction && (
            <span className={`badge badge-${lastAction.status}`}>
              最近：{lastAction.studentName} - {statusLabel(lastAction.status as AttendanceStatus)}
            </span>
          )}
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>学生</th>
                <th>学号</th>
                <th>班级</th>
                <th>小组</th>
                <th>点名操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map(student => (
                <tr key={student.id}>
                  <td>
                    <div className="student-row">
                      <span className="student-avatar">{student.name[0]}</span>
                      {student.name}
                    </div>
                  </td>
                  <td>{student.studentId}</td>
                  <td>{student.class}</td>
                  <td>{groupMap.get(student.groupId || '')?.name || '未分配'}</td>
                  <td>
                    <div className="btn-group">
                      <button
                        className="btn btn-success btn-sm"
                        onClick={() => recordStatus(student.id, student.name, 'present')}
                        title="标记到岗"
                      >
                        ✓ 到岗
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => recordStatus(student.id, student.name, 'absent')}
                        title="标记缺勤"
                      >
                        ✗ 缺勤
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => recordStatus(student.id, student.name, 'late')}
                        title="标记迟到"
                      >
                        ⏱ 迟到
                      </button>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => recordStatus(student.id, student.name, 'leave')}
                        title="标记请假（需审批）"
                      >
                        📝 请假
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredStudents.length === 0 && (
            <div className="empty-state">
              <p>未找到匹配的学生</p>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">操作说明</h2>
        </div>
        <div className="info-message">
          <strong>📌 业务规则（系统自动拦截）：</strong>
          <ul style={{ marginLeft: '1.5rem', marginTop: '0.5rem' }}>
            <li><strong>请假状态</strong>：必须先提交请假申请并获得批准，否则无法直接标记为请假</li>
            <li><strong>缺勤恢复</strong>：已标记为缺勤的学生不能直接标记为到岗，需先处理缺勤原因</li>
            <li><strong>数据校验</strong>：学生或集合点不存在时会提示数据缺失</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
