import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import GradingQueue from './pages/GradingQueue';
import SubmissionDetail from './pages/SubmissionDetail';
import Reports from './pages/Reports';
import TeacherView from './pages/TeacherView';
import Management from './pages/Management';

const App = () => {
  const [currentRole, setCurrentRole] = useState('assistant');
  const [currentAssistant, setCurrentAssistant] = useState({ id: 'ta-1', name: '陈助教' });

  return (
    <Router>
      <div className="app-container">
        <header className="app-header">
          <div className="header-left">
            <h1>📚 课堂助教批改台</h1>
            <span className="role-badge">{currentRole === 'assistant' ? '👨‍🏫 助教' : '👩‍🎓 老师'}</span>
          </div>
          <div className="header-right">
            <div className="role-switcher">
              <button 
                className={`btn-switch ${currentRole === 'assistant' ? 'active' : ''}`}
                onClick={() => setCurrentRole('assistant')}
              >
                助教模式
              </button>
              <button 
                className={`btn-switch ${currentRole === 'teacher' ? 'active' : ''}`}
                onClick={() => setCurrentRole('teacher')}
              >
                老师模式
              </button>
            </div>
            {currentRole === 'assistant' && (
              <select 
                className="assistant-select"
                value={currentAssistant.id}
                onChange={(e) => {
                  const id = e.target.value;
                  const name = e.target.options[e.target.selectedIndex].text;
                  setCurrentAssistant({ id, name });
                }}
              >
                <option value="ta-1">陈助教</option>
                <option value="ta-2">刘助教</option>
                <option value="ta-3">周助教</option>
              </select>
            )}
          </div>
        </header>

        <nav className="app-nav">
          <Link to="/" className="nav-link">📊 概览</Link>
          {currentRole === 'assistant' && (
            <>
              <Link to="/queue" className="nav-link">📋 批改队列</Link>
              <Link to="/management" className="nav-link">⚙️ 管理</Link>
            </>
          )}
          <Link to="/reports" className="nav-link">📈 报表</Link>
          {currentRole === 'teacher' && (
            <Link to="/teacher" className="nav-link">👀 老师视图</Link>
          )}
        </nav>

        <main className="app-main">
          <Routes>
            <Route path="/" element={<Dashboard currentRole={currentRole} />} />
            <Route 
              path="/queue" 
              element={currentRole === 'assistant' ? <GradingQueue currentAssistant={currentAssistant} /> : <Navigate to="/" />} 
            />
            <Route path="/submission/:id" element={<SubmissionDetail currentAssistant={currentAssistant} />} />
            <Route path="/reports" element={<Reports />} />
            <Route 
              path="/teacher" 
              element={currentRole === 'teacher' ? <TeacherView /> : <Navigate to="/" />} 
            />
            <Route 
              path="/management" 
              element={currentRole === 'assistant' ? <Management /> : <Navigate to="/" />} 
            />
          </Routes>
        </main>
      </div>
    </Router>
  );
};

export default App;
