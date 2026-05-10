import { useEffect, useState } from 'react';
import { api } from '../api';
import type { GroupChange, Student, Group } from '../types';

export default function GroupChangesPage() {
  const [changes, setChanges] = useState<GroupChange[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [changesData, studentsData, groupsData] = await Promise.all([
        api.getGroupChanges(),
        api.getStudents(),
        api.getGroups(),
      ]);
      setChanges(changesData);
      setStudents(studentsData);
      setGroups(groupsData);
    } catch (e) {
      console.error('加载数据失败', e);
    } finally {
      setLoading(false);
    }
  }

  const studentMap = new Map(students.map(s => [s.id, s]));
  const groupMap = new Map(groups.map(g => [g.id, g]));

  const filteredChanges = changes.filter(c => {
    const student = studentMap.get(c.studentId);
    return !search ||
      student?.name.includes(search) ||
      student?.studentId.includes(search);
  });

  if (loading) {
    return <div className="loading"><div className="spinner"></div>加载中...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">换组历史</h1>
        <p className="page-subtitle">查看所有临时换组记录，包含原始输入信息</p>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">换组记录 ({changes.length} 条)</h2>
          <div style={{ width: '250px' }}>
            <input
              type="text"
              placeholder="搜索学生姓名或学号..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
        </div>

        {filteredChanges.length > 0 ? (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>时间</th>
                  <th>学生</th>
                  <th>变动</th>
                  <th>原因</th>
                  <th>操作人</th>
                  <th>原始输入</th>
                </tr>
              </thead>
              <tbody>
                {filteredChanges.map(change => {
                  const student = studentMap.get(change.studentId);
                  const oldGroup = groupMap.get(change.oldGroupId || '');
                  const newGroup = groupMap.get(change.newGroupId || '');
                  return (
                    <tr key={change.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {new Date(change.timestamp).toLocaleString()}
                      </td>
                      <td>
                        <div className="student-row">
                          <span className="student-avatar">{student?.name?.[0] || '?'}</span>
                          <div>
                            <div>{student?.name || '未知'}</div>
                            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                              {student?.studentId}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ color: '#dc2626' }}>
                            {oldGroup?.name || '未分组'}
                          </span>
                          <span style={{ color: '#9ca3af' }}>→</span>
                          <span style={{ color: '#059669' }}>
                            {newGroup?.name || '未分组'}
                          </span>
                        </div>
                      </td>
                      <td>{change.reason || '-'}</td>
                      <td>{change.operatorId}</td>
                      <td style={{ maxWidth: '300px' }}>
                        {change.rawInput ? (
                          <span style={{
                            fontFamily: 'monospace',
                            fontSize: '0.8rem',
                            background: '#f9fafb',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px',
                            display: 'inline-block',
                            maxWidth: '100%',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }} title={change.rawInput}>
                            {change.rawInput}
                          </span>
                        ) : (
                          <span style={{ color: '#9ca3af' }}>-</span>
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
            <p>暂无换组记录</p>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">导出换组记录</h2>
        </div>
        <p style={{ color: '#6b7280', marginBottom: '1rem' }}>
          导出完整的换组历史记录，包含时间、学生、原小组、新小组、原因、操作人和原始输入
        </p>
        <button
          className="btn btn-primary"
          onClick={() => api.downloadGroupChangesCSV()}
        >
          📥 导出 CSV
        </button>
      </div>
    </div>
  );
}
