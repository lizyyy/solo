import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import axios from 'axios';
import DocumentsList from './components/DocumentsList';
import DocumentDetail from './components/DocumentDetail';
import ExecutionsList from './components/ExecutionsList';
import FavoritesList from './components/FavoritesList';

function App() {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const initSampleData = async () => {
      try {
        await axios.post('/api/init-sample-data');
        setInitialized(true);
      } catch (error) {
        console.log('Sample data may already exist');
        setInitialized(true);
      }
    };
    initSampleData();
  }, []);

  return (
    <Router>
      <div className="app">
        <nav className="navbar">
          <h1>API文档互动示例台</h1>
          <div className="nav-links">
            <NavLink to="/" end>文档列表</NavLink>
            <NavLink to="/executions">执行记录</NavLink>
            <NavLink to="/favorites">示例收藏</NavLink>
          </div>
        </nav>
        <div className="container">
          <Routes>
            <Route path="/" element={<DocumentsList />} />
            <Route path="/documents/:id" element={<DocumentDetail />} />
            <Route path="/executions" element={<ExecutionsList />} />
            <Route path="/favorites" element={<FavoritesList />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
