import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import AppLayout from './components/Layout';
import RedemptionList from './pages/RedemptionList';
import RedemptionDetail from './pages/RedemptionDetail';
import RedemptionEdit from './pages/RedemptionEdit';
import BatchList from './pages/BatchList';
import Reports from './pages/Reports';
import './App.css';

const App: React.FC = () => {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#165DFF',
          colorSuccess: '#00B42A',
          colorWarning: '#FF7D00',
          colorError: '#F53F3F',
          colorInfo: '#86909C',
          borderRadius: 8,
          fontFamily: "'Noto Sans SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        },
        components: {
          Button: {
            controlHeight: 36,
            borderRadius: 8,
          },
          Card: {
            borderRadiusLG: 12,
          },
          Table: {
            borderRadius: 8,
          }
        }
      }}
    >
      <Router>
        <AppLayout>
          <Routes>
            <Route path="/" element={<RedemptionList />} />
            <Route path="/redemption/new" element={<RedemptionEdit />} />
            <Route path="/redemption/:id" element={<RedemptionDetail />} />
            <Route path="/redemption/:id/edit" element={<RedemptionEdit />} />
            <Route path="/batches" element={<BatchList />} />
            <Route path="/batches/:id" element={<BatchList />} />
            <Route path="/reports" element={<Reports />} />
          </Routes>
        </AppLayout>
      </Router>
    </ConfigProvider>
  );
};

export default App;
