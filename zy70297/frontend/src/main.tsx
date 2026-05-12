import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import './index.css';
import Dashboard from './pages/Dashboard';
import MerchantList from './pages/MerchantList';
import MerchantDetail from './pages/MerchantDetail';
import TaskList from './pages/TaskList';
import TaskDetail from './pages/TaskDetail';

function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <header>
          <h1>🔥 商户燃气安检整改台</h1>
        </header>
        <nav>
          <NavLink to="/" end>
            📊 监管报表
          </NavLink>
          <NavLink to="/merchants">
            🏪 商户档案
          </NavLink>
          <NavLink to="/tasks">
            📋 整改任务
          </NavLink>
        </nav>
        <main>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/merchants" element={<MerchantList />} />
            <Route path="/merchants/:id" element={<MerchantDetail />} />
            <Route path="/tasks" element={<TaskList />} />
            <Route path="/tasks/:id" element={<TaskDetail />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
