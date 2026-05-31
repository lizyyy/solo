import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ConfigProvider, App as AntApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import MainLayout from './components/MainLayout';
import NotificationBar from './components/NotificationBar';
import Dashboard from './pages/Dashboard';
import QuestionBank from './pages/QuestionBank';
import EvaluationRecords from './pages/EvaluationRecords';
import Diagnosis from './pages/Diagnosis';
import FilterConditions from './pages/FilterConditions';
import './index.css';

const App: React.FC = () => {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#1e3a5f',
          colorSuccess: '#10b981',
          colorWarning: '#f59e0b',
          colorError: '#ef4444',
          colorInfo: '#3b82f6',
          borderRadius: 6,
          fontFamily: '"Noto Sans SC", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: 14,
        },
        components: {
          Button: {
            controlHeight: 36,
            borderRadius: 6,
          },
          Card: {
            borderRadiusLG: 8,
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px 0 rgba(0, 0, 0, 0.03)',
          },
          Table: {
            borderRadius: 8,
          },
        },
      }}
    >
      <AntApp>
        <NotificationBar />
        <BrowserRouter>
          <MainLayout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/question-bank" element={<QuestionBank />} />
              <Route path="/evaluation-records" element={<EvaluationRecords />} />
              <Route path="/diagnosis" element={<Diagnosis />} />
              <Route path="/filter-conditions" element={<FilterConditions />} />
            </Routes>
          </MainLayout>
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  );
};

export default App;
