import { useEffect, useState, useRef } from 'react';
import { api } from '../api';
import type { Student, Group, Teacher, ApiError, GroupChange } from '../types';

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentChanges, setStudentChanges] = useState<GroupChange[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [importError, setImportError] = useState<ApiError | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [studentsData, groupsData, teachersData] = await Promise.all([
        api.getStudents(),
        api.getGroups(),
        api.getTeachers(),
      ]);
      setStudents(studentsData);
      setGroups(groupsData);
      setTeachers(teachersData);
    } catch (e) {
      console.error('加载数据失败', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setError(null);
      setImportError(null);
      const result = await api.importStudents(file);
      if (result.errors && result.errors.length > 0) {
        setImportError(result.errors[0]);
      } else {
        setSuccess(`成功导入 ${result.imported} 名学生`);
        setTimeout(() => setSuccess(null), 3000);
        await loadData();
      }
    } catch (e) {
      setError('导入失败：' + (e as Error).message);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleGroupChange(studentId: string, newGroupId: string) {
    try {
      setError(null);
      await api.changeGroup({
        studentId,
        newGroupId: newGroupId || null,
        reason: '手动调整',
      });
      setSuccess('分组更新成功');
      setTimeout(() => setSuccess(null), 2000);
      await loadData();
      if (selectedStudent?.id === studentId) {
        const updated = students.find(s => s.id === studentId);
        if (updated) {
          const changes = await api.getGroupChanges(studentId);
          setStudentChanges(changes);
          setSelectedStudent({ ...updated, groupId: newGroupId || null });
        }
      }
    } catch (e) {
      const apiErr = e as ApiError;
      setError(apiErr.message);
      console.error('更新分组失败', e);
    }
  }

  async function viewStudentDetail(student: Student) {
    setSelectedStudent(student);
    const changes = await api.getGroupChanges(student.id);
    setStudentChanges(changes);
  }

  const groupMap = new Map(groups.map(g => [g.id, g]));
  const teacherMap = new Map(teachers.map(t => [t.id, t]));

  const filteredStudents = students.filter(s =>
    s.name.includes(search) ||
    s.studentId.includes(search) ||
    s.class.includes(search)
  );

  if (loading) {
    return <div className="loading"><div className="spinner"></div>加载中...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">学生管理</h1>
        <p className="page-subtitle">导入学生名单、分配小组和带队老师</p>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}
      {importError && (
        <div className="error-message">
          <strong>导入错误 ({importError.code})</strong>
          {importError.message}
          {importError.rawInput && (
            <div className="raw-input">原始输入：{importError.rawInput.slice(0, 200)}...</div>
          )}
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">导入学生名单</h2>
        </div>
        <div className="info-message mb-4">
          <strong>支持格式：</strong>Excel (.xlsx) 或 CSV。列名：姓名、学号、班级、性别、电话、紧急联系人
        </div>
        <label
          className="file-upload-area"
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileUpload}
          />
          <div>
            <p style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>📁</p>
            <p style={{ color: '#4b5563', fontWeight: '500' }}>点击或拖拽上传学生名单</p>
            <p style={{ color: '#9ca3af', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              支持 .xlsx, .xls, .csv 格式
            </p>
          </div>
        </label>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">学生列表 ({students.length} 人)</h2>
        </div>

        <div className="search-bar">
          <input
            type="text"
            placeholder="搜索姓名、学号或班级..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>学生</th>
                <th>学号</th>
                <th>班级</th>
                <th>性别</th>
                <th>小组</th>
                <th>操作</th>
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
                  <td>{student.gender}</td>
                  <td>
                    <select
                      value={student.groupId || ''}
                      onChange={e => handleGroupChange(student.id, e.target.value)}
                      style={{ padding: '0.375rem 0.625rem', fontSize: '0.85rem' }}
                    >
                      <option value="">-- 未分配 --</option>
                      {groups.map(g => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => viewStudentDetail(student)}
                    >
                      详情
                    </button>
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

      {selectedStudent && (
        <div className="modal-overlay" onClick={() => setSelectedStudent(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">学生详情</h3>
              <button className="modal-close" onClick={() => setSelectedStudent(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="detail-grid">
                <div className="detail-item">
                  <div className="detail-label">姓名</div>
                  <div className="detail-value">{selectedStudent.name}</div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">学号</div>
                  <div className="detail-value">{selectedStudent.studentId}</div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">班级</div>
                  <div className="detail-value">{selectedStudent.class}</div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">性别</div>
                  <div className="detail-value">{selectedStudent.gender}</div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">联系电话</div>
                  <div className="detail-value">{selectedStudent.phone}</div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">紧急联系人</div>
                  <div className="detail-value">{selectedStudent.emergencyContact}</div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">所在小组</div>
                  <div className="detail-value">
                    {groupMap.get(selectedStudent.groupId || '')?.name || '未分配'}
                  </div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">状态</div>
                  <div className="detail-value">
                    <span className={`badge badge-${selectedStudent.status === 'active' ? 'present' : 'absent'}`}>
                      {selectedStudent.status === 'active' ? '正常' : '停用'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="divider"></div>

              <div className="section">
                <h4 className="section-title">换组历史</h4>
                {studentChanges.length > 0 ? (
                  <div className="timeline">
                    {studentChanges.map(change => (
                      <div key={change.id} className="timeline-item">
                        <div className="timeline-time">
                          {new Date(change.timestamp).toLocaleString()}
                        </div>
                        <div className="timeline-content">
                          <strong>
                            {groupMap.get(change.oldGroupId || '')?.name || '未分组'}
                            {' → '}
                            {groupMap.get(change.newGroupId || '')?.name || '未分组'}
                          </strong>
                          <div style={{ color: '#6b7280', fontSize: '0.8rem', marginTop: '0.125rem' }}>
                            {change.reason} · {change.operatorId}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>暂无换组记录</p>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-outline"
                onClick={() => setSelectedStudent(null)}
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
