import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import ApplicationDetail from './pages/ApplicationDetail';
import CreateApplication from './pages/CreateApplication';
import ExportPage from './pages/ExportPage';
import axios from 'axios';

function NavLink({ to, children }) {
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <Link to={to} className={isActive ? 'active' : ''}>{children}</Link>
  );
}

function App() {
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get('/api/users')
      .then(response => {
        setUsers(response.data);
        if (response.data.length > 0) {
          setCurrentUser(response.data[0]);
        }
        setLoading(false);
      })
      .catch(error => {
        console.error('Failed to fetch users:', error);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="loading">
        <p>加载中...</p>
      </div>
    );
  }

  const handleUserChange = (userId) => {
    const user = users.find(u => u.id === userId);
    setCurrentUser(user);
  };

  return (
    <Router>
      <div className="app">
        <header className="header">
          <div className="container">
            <h1>商场夜间施工申请管理系统</h1>
            <nav className="nav">
              <NavLink to="/">看板</NavLink>
              <NavLink to="/create">新建申请</NavLink>
              <NavLink to="/export">数据导出</NavLink>
            </nav>
          </div>
        </header>

        <main className="container">
          {currentUser && (
            <div className="user-selector">
              <label>当前身份：</label>
              <select 
                value={currentUser.id} 
                onChange={(e) => handleUserChange(e.target.value)}
              >
                {users.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.name} ({user.role_name})
                  </option>
                ))}
              </select>
              <span style={{ color: '#666', fontSize: '0.9rem' }}>
                角色: {currentUser.role_name}
              </span>
            </div>
          )}

          <Routes>
            <Route path="/" element={<Dashboard currentUser={currentUser} />} />
            <Route path="/application/:id" element={<ApplicationDetail currentUser={currentUser} />} />
            <Route path="/create" element={<CreateApplication currentUser={currentUser} />} />
            <Route path="/export" element={<ExportPage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
