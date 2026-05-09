import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from 'antd';
import MainLayout from './components/MainLayout';
import Dashboard from './pages/Dashboard';
import LogSearch from './pages/LogSearch';
import TraceList from './pages/TraceList';
import TraceReplay from './pages/TraceReplay';
import ReportGenerator from './pages/ReportGenerator';
import ReportList from './pages/ReportList';

const { Content } = Layout;

const App = () => {
  return (
    <MainLayout>
      <Content style={{ margin: '24px 16px', padding: 24, minHeight: 280 }}>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/logs" element={<LogSearch />} />
          <Route path="/traces" element={<TraceList />} />
          <Route path="/traces/:traceId" element={<TraceReplay />} />
          <Route path="/reports" element={<ReportList />} />
          <Route path="/reports/generate" element={<ReportGenerator />} />
        </Routes>
      </Content>
    </MainLayout>
  );
};

export default App;
