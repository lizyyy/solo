import React from 'react';
import { Routes, Route } from 'react-router-dom';
import TemplateList from './pages/TemplateList';
import TemplateDetail from './pages/TemplateDetail';

function App() {
  return (
    <div>
      <header className="header">
        <div className="container" style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <h1>📝 消息模板发布台</h1>
        </div>
      </header>
      <Routes>
        <Route path="/" element={<TemplateList />} />
        <Route path="/templates/:id" element={<TemplateDetail />} />
      </Routes>
    </div>
  );
}

export default App;