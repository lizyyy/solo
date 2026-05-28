import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import MainLayout from './components/Layout/MainLayout';
import Dashboard from './pages/Dashboard/Dashboard';
import ImportCenter from './pages/ImportCenter/ImportCenter';
import Exposure from './pages/Exposure/Exposure';
import Matching from './pages/Matching/Matching';
import Rollover from './pages/Rollover/Rollover';
import Export from './pages/Export/Export';
import Audit from './pages/Audit/Audit';

export default function App() {
  return (
    <ConfigProvider locale={zhCN}>
      <Router>
        <MainLayout>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/import" element={<ImportCenter />} />
            <Route path="/exposure" element={<Exposure />} />
            <Route path="/matching" element={<Matching />} />
            <Route path="/rollover" element={<Rollover />} />
            <Route path="/export" element={<Export />} />
            <Route path="/audit" element={<Audit />} />
          </Routes>
        </MainLayout>
      </Router>
    </ConfigProvider>
  );
}
