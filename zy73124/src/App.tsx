import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import Layout from '@/components/Layout';
import ReportList from '@/pages/ReportList';
import ReportDetail from '@/pages/ReportDetail';
import AbnormalZone from '@/pages/AbnormalZone';

export default function App() {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#1e3a5f',
          borderRadius: 4,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif',
        },
      }}
    >
      <Router>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<ReportList />} />
            <Route path="report/:id" element={<ReportDetail />} />
            <Route path="abnormal" element={<AbnormalZone />} />
          </Route>
        </Routes>
      </Router>
    </ConfigProvider>
  );
}
