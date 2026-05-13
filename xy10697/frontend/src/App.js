import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import CylinderList from './components/CylinderList';
import CylinderDetail from './components/CylinderDetail';
import ExportPage from './components/ExportPage';
import './App.css';

function App() {
  return (
    <Router>
      <div className="app">
        <header className="header">
          <h1>工业气瓶周转回收管理系统</h1>
          <nav className="nav">
            <Link to="/" className="nav-link">气瓶列表</Link>
            <Link to="/export" className="nav-link">导出报告</Link>
          </nav>
        </header>
        <main className="main">
          <Routes>
            <Route path="/" element={<CylinderList />} />
            <Route path="/cylinder/:id" element={<CylinderDetail />} />
            <Route path="/export" element={<ExportPage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
