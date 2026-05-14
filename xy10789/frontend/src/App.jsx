import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import ArticlesList from './pages/ArticlesList';
import ArticleDetail from './pages/ArticleDetail';
import RevisionDrafts from './pages/RevisionDrafts';
import UserSelector from './components/UserSelector';
import { setUserId } from './api';

function App() {
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const savedUserId = localStorage.getItem('userId');
    if (savedUserId) {
      setUserId(savedUserId);
      setCurrentUser({ id: parseInt(savedUserId) });
    }
  }, []);

  const handleUserChange = (user) => {
    setCurrentUser(user);
    if (user) {
      setUserId(user.id);
      localStorage.setItem('userId', user.id);
    } else {
      localStorage.removeItem('userId');
    }
  };

  return (
    <BrowserRouter>
      <div style={styles.app}>
        <nav style={styles.nav}>
          <h1 style={styles.title}>知识库反馈闭环台</h1>
          <div style={styles.navLinks}>
            <Link to="/" style={styles.link}>仪表盘</Link>
            <Link to="/articles" style={styles.link}>文章版本</Link>
            <Link to="/drafts" style={styles.link}>修订草稿</Link>
          </div>
          <UserSelector currentUser={currentUser} onUserChange={handleUserChange} />
        </nav>
        
        <main style={styles.main}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/articles" element={<ArticlesList />} />
            <Route path="/articles/:id" element={<ArticleDetail />} />
            <Route path="/drafts" element={<RevisionDrafts />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

const styles = {
  app: {
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
  },
  nav: {
    backgroundColor: '#2c3e50',
    padding: '1rem 2rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  title: {
    color: 'white',
    margin: 0,
    fontSize: '1.5rem',
  },
  navLinks: {
    display: 'flex',
    gap: '1.5rem',
  },
  link: {
    color: '#ecf0f1',
    textDecoration: 'none',
    fontSize: '1rem',
    '&:hover': {
      color: '#3498db',
    },
  },
  main: {
    padding: '2rem',
    maxWidth: '1400px',
    margin: '0 auto',
  },
};

export default App;
