import React, { useState, useEffect } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import axios from 'axios';
import Home from './pages/Home';
import SessionDetail from './pages/SessionDetail';
import CollaborationLogs from './pages/CollaborationLogs';
import './App.css';

const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  timeout: 5000
});

function App() {
  const [currentUser, setCurrentUser] = useState('user_' + Math.random().toString(36).substr(2, 5));

  return (
    <div className="app">
      <nav className="navbar">
        <div className="nav-container">
          <h1 className="nav-title">🔐 实时协作文档锁系统</h1>
          <div className="nav-links">
            <Link to="/" className="nav-link">文档会话</Link>
            <Link to="/logs" className="nav-link">协作日志</Link>
          </div>
          <div className="nav-user">
            当前用户: <span className="user-tag">{currentUser}</span>
          </div>
        </div>
      </nav>
      
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Home api={api} currentUser={currentUser} />} />
          <Route path="/session/:id" element={<SessionDetail api={api} currentUser={currentUser} />} />
          <Route path="/logs" element={<CollaborationLogs api={api} />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
