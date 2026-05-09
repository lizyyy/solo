import React from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import KnowledgeBase from './pages/KnowledgeBase';
import QARecords from './pages/QARecords';
import ValidationResults from './pages/ValidationResults';
import Exports from './pages/Exports';

const App: React.FC = () => {
  return (
    <div className="container">
      <div className="header">
        <h1>知识库问答引用校验器</h1>
        <p>校验问答系统引用的准确性，追踪错误样本和修正历史</p>
      </div>

      <nav className="nav">
        <NavLink to="/" className="nav-link" end>
          📊 概览
        </NavLink>
        <NavLink to="/knowledge-base" className="nav-link">
          📚 知识库
        </NavLink>
        <NavLink to="/qa-records" className="nav-link">
          ❓ 问答记录
        </NavLink>
        <NavLink to="/validation" className="nav-link">
          ✅ 校验结果
        </NavLink>
        <NavLink to="/exports" className="nav-link">
          📤 数据导出
        </NavLink>
      </nav>

      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/knowledge-base" element={<KnowledgeBase />} />
        <Route path="/qa-records" element={<QARecords />} />
        <Route path="/validation" element={<ValidationResults />} />
        <Route path="/exports" element={<Exports />} />
      </Routes>
    </div>
  );
};

export default App;
