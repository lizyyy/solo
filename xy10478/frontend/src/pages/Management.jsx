import React, { useState, useEffect } from 'react';
import { api } from '../api';

const Management = () => {
  const [activeTab, setActiveTab] = useState('courses');
  const [courses, setCourses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [students, setStudents] = useState([]);
  const [assistants, setAssistants] = useState([]);
  const [message, setMessage] = useState(null);

  const [newCourse, setNewCourse] = useState({ name: '', teacher: '', semester: '2024秋季' });
  const [newAssignment, setNewAssignment] = useState({ courseId: '', name: '', type: 'programming', deadline: '', totalScore: 100, description: '' });
  const [newStudent, setNewStudent] = useState({ name: '', studentId: '', courseIds: [] });
  const [newAssistant, setNewAssistant] = useState({ name: '', maxWorkload: 10 });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [c, a, s, ta] = await Promise.all([
      api.getCourses(),
      api.getAssignments(),
      api.getStudents(),
      api.getAssistants()
    ]);
    setCourses(c);
    setAssignments(a);
    setStudents(s);
    setAssistants(ta);
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleAddCourse = async (e) => {
    e.preventDefault();
    try {
      await api.createCourse(newCourse);
      showMessage('success', '课程添加成功');
      setNewCourse({ name: '', teacher: '', semester: '2024秋季' });
      loadData();
    } catch (error) {
      showMessage('danger', error.message);
    }
  };

  const handleAddAssignment = async (e) => {
    e.preventDefault();
    try {
      await api.createAssignment(newAssignment);
      showMessage('success', '作业添加成功');
      setNewAssignment({ courseId: '', name: '', type: 'programming', deadline: '', totalScore: 100, description: '' });
      loadData();
    } catch (error) {
      showMessage('danger', error.message);
    }
  };

  const handleAddStudent = async (e) => {
    e.preventDefault();
    try {
      await api.createStudent(newStudent);
      showMessage('success', '学生添加成功');
      setNewStudent({ name: '', studentId: '', courseIds: [] });
      loadData();
    } catch (error) {
      showMessage('danger', error.message);
    }
  };

  const handleAddAssistant = async (e) => {
    e.preventDefault();
    try {
      await api.createAssistant(newAssistant);
      showMessage('success', '助教添加成功');
      setNewAssistant({ name: '', maxWorkload: 10 });
      loadData();
    } catch (error) {
      showMessage('danger', error.message);
    }
  };

  const toggleCourseSelection = (courseId) => {
    const current = newStudent.courseIds;
    if (current.includes(courseId)) {
      setNewStudent({ ...newStudent, courseIds: current.filter(id => id !== courseId) });
    } else {
      setNewStudent({ ...newStudent, courseIds: [...current, courseId] });
    }
  };

  const typeLabels = {
    programming: '编程',
    essay: '作文',
    quiz: '测验'
  };

  return (
    <div>
      <h1 className="page-title">⚙️ 管理</h1>

      {message && (
        <div className={`alert-box ${message.type}`}>
          <div className="alert-icon">{message.type === 'success' ? '✅' : '❌'}</div>
          <div className="alert-content">
            <div className="title">{message.type === 'success' ? '成功' : '错误'}</div>
            <p>{message.text}</p>
          </div>
        </div>
      )}

      <div className="tabs">
        <button 
          className={`tab-btn ${activeTab === 'courses' ? 'active' : ''}`}
          onClick={() => setActiveTab('courses')}
        >
          📚 课程管理
        </button>
        <button 
          className={`tab-btn ${activeTab === 'assignments' ? 'active' : ''}`}
          onClick={() => setActiveTab('assignments')}
        >
          📝 作业管理
        </button>
        <button 
          className={`tab-btn ${activeTab === 'students' ? 'active' : ''}`}
          onClick={() => setActiveTab('students')}
        >
          👨‍🎓 学生管理
        </button>
        <button 
          className={`tab-btn ${activeTab === 'assistants' ? 'active' : ''}`}
          onClick={() => setActiveTab('assistants')}
        >
          👨‍🏫 助教管理
        </button>
      </div>

      {activeTab === 'courses' && (
        <div className="management-grid">
          <div className="card">
            <div className="card-header">
              <h2>添加课程</h2>
            </div>
            <div className="card-body">
              <form onSubmit={handleAddCourse}>
                <div className="form-group">
                  <label>课程名称</label>
                  <input 
                    type="text" 
                    value={newCourse.name}
                    onChange={(e) => setNewCourse({ ...newCourse, name: e.target.value })}
                    placeholder="如：软件工程导论"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>授课教师</label>
                  <input 
                    type="text" 
                    value={newCourse.teacher}
                    onChange={(e) => setNewCourse({ ...newCourse, teacher: e.target.value })}
                    placeholder="如：李教授"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>学期</label>
                  <select 
                    value={newCourse.semester}
                    onChange={(e) => setNewCourse({ ...newCourse, semester: e.target.value })}
                  >
                    <option value="2024秋季">2024秋季</option>
                    <option value="2025春季">2025春季</option>
                    <option value="2025秋季">2025秋季</option>
                  </select>
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                  添加课程
                </button>
              </form>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h2>已有课程</h2>
              <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>共 {courses.length} 门</span>
            </div>
            <div className="card-body">
              {courses.length === 0 ? (
                <div className="empty-state">
                  <div className="icon">📭</div>
                  <p>暂无课程</p>
                </div>
              ) : (
                courses.map(course => (
                  <div key={course.id} className="list-item">
                    <div className="info">
                      <span className="name">{course.name}</span>
                      <span className="meta">{course.teacher} · {course.semester}</span>
                    </div>
                    <span className="type-badge type-programming">
                      {assignments.filter(a => a.courseId === course.id).length}份作业
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'assignments' && (
        <div className="management-grid">
          <div className="card">
            <div className="card-header">
              <h2>添加作业</h2>
            </div>
            <div className="card-body">
              <form onSubmit={handleAddAssignment}>
                <div className="form-group">
                  <label>所属课程</label>
                  <select 
                    value={newAssignment.courseId}
                    onChange={(e) => setNewAssignment({ ...newAssignment, courseId: e.target.value })}
                    required
                  >
                    <option value="">请选择课程</option>
                    {courses.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>作业名称</label>
                  <input 
                    type="text" 
                    value={newAssignment.name}
                    onChange={(e) => setNewAssignment({ ...newAssignment, name: e.target.value })}
                    placeholder="如：编程作业：简易计算器"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>作业类型</label>
                  <select 
                    value={newAssignment.type}
                    onChange={(e) => setNewAssignment({ ...newAssignment, type: e.target.value })}
                  >
                    <option value="programming">编程作业</option>
                    <option value="essay">作文</option>
                    <option value="quiz">测验</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>截止时间</label>
                  <input 
                    type="datetime-local" 
                    value={newAssignment.deadline}
                    onChange={(e) => setNewAssignment({ ...newAssignment, deadline: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>满分</label>
                  <input 
                    type="number" 
                    min="1"
                    max="1000"
                    value={newAssignment.totalScore}
                    onChange={(e) => setNewAssignment({ ...newAssignment, totalScore: parseInt(e.target.value) })}
                  />
                </div>
                <div className="form-group">
                  <label>作业描述</label>
                  <textarea 
                    value={newAssignment.description}
                    onChange={(e) => setNewAssignment({ ...newAssignment, description: e.target.value })}
                    placeholder="请描述作业要求..."
                  />
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                  添加作业
                </button>
              </form>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h2>已有作业</h2>
              <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>共 {assignments.length} 份</span>
            </div>
            <div className="card-body">
              {assignments.length === 0 ? (
                <div className="empty-state">
                  <div className="icon">📭</div>
                  <p>暂无作业</p>
                </div>
              ) : (
                assignments.map(assignment => (
                  <div key={assignment.id} className="list-item">
                    <div className="info">
                      <span className="name">{assignment.name}</span>
                      <span className="meta">
                        {courses.find(c => c.id === assignment.courseId)?.name} · 
                        满分{assignment.totalScore}分
                      </span>
                    </div>
                    <span className={`type-badge type-${assignment.type}`}>
                      {typeLabels[assignment.type]}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'students' && (
        <div className="management-grid">
          <div className="card">
            <div className="card-header">
              <h2>添加学生</h2>
            </div>
            <div className="card-body">
              <form onSubmit={handleAddStudent}>
                <div className="form-group">
                  <label>姓名</label>
                  <input 
                    type="text" 
                    value={newStudent.name}
                    onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                    placeholder="如：张三"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>学号</label>
                  <input 
                    type="text" 
                    value={newStudent.studentId}
                    onChange={(e) => setNewStudent({ ...newStudent, studentId: e.target.value })}
                    placeholder="如：2021001"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>选修课程</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {courses.map(course => (
                      <label 
                        key={course.id}
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '0.25rem',
                          padding: '0.5rem',
                          background: newStudent.courseIds.includes(course.id) ? '#e0e7ff' : '#f9fafb',
                          borderRadius: '6px',
                          cursor: 'pointer'
                        }}
                      >
                        <input 
                          type="checkbox"
                          checked={newStudent.courseIds.includes(course.id)}
                          onChange={() => toggleCourseSelection(course.id)}
                        />
                        <span style={{ fontSize: '0.875rem' }}>{course.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                  添加学生
                </button>
              </form>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h2>已有学生</h2>
              <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>共 {students.length} 人</span>
            </div>
            <div className="card-body">
              {students.length === 0 ? (
                <div className="empty-state">
                  <div className="icon">📭</div>
                  <p>暂无学生</p>
                </div>
              ) : (
                students.map(student => (
                  <div key={student.id} className="list-item">
                    <div className="info">
                      <span className="name">{student.name}</span>
                      <span className="meta">学号: {student.studentId}</span>
                    </div>
                    <span className="type-badge type-quiz">
                      {student.courseIds.length}门课程
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'assistants' && (
        <div className="management-grid">
          <div className="card">
            <div className="card-header">
              <h2>添加助教</h2>
            </div>
            <div className="card-body">
              <form onSubmit={handleAddAssistant}>
                <div className="form-group">
                  <label>姓名</label>
                  <input 
                    type="text" 
                    value={newAssistant.name}
                    onChange={(e) => setNewAssistant({ ...newAssistant, name: e.target.value })}
                    placeholder="如：陈助教"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>最大负载（同时批改的作业数）</label>
                  <input 
                    type="number" 
                    min="1"
                    max="50"
                    value={newAssistant.maxWorkload}
                    onChange={(e) => setNewAssistant({ ...newAssistant, maxWorkload: parseInt(e.target.value) })}
                  />
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                  添加助教
                </button>
              </form>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h2>已有助教</h2>
              <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>共 {assistants.length} 人</span>
            </div>
            <div className="card-body">
              {assistants.length === 0 ? (
                <div className="empty-state">
                  <div className="icon">📭</div>
                  <p>暂无助教</p>
                </div>
              ) : (
                assistants.map(assistant => {
                  const ratio = assistant.workload / assistant.maxWorkload;
                  const level = ratio >= 0.8 ? 'high' : ratio >= 0.5 ? 'medium' : 'low';
                  return (
                    <div key={assistant.id} className="list-item">
                      <div className="info">
                        <span className="name">{assistant.name}</span>
                        <span className="meta">
                          负载: {assistant.workload}/{assistant.maxWorkload}
                        </span>
                      </div>
                      <div className={`workload-indicator ${level}`}>
                        <div className="progress-bar" style={{ width: '100px', height: '6px' }}>
                          <div className="fill" style={{ width: `${ratio * 100}%` }}></div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Management;
