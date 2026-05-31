import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ConfigProvider } from 'antd';
import { Layout } from '@/components/Layout';
import { Dashboard } from '@/pages/Dashboard';
import { PhotosManagement } from '@/pages/PhotosManagement';
import { MagneticScanner } from '@/pages/MagneticScanner';
import { UnitValidator } from '@/pages/UnitValidator';
import { VersionHistory } from '@/pages/VersionHistory';

export default function App() {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#165DFF',
          borderRadius: 6,
        },
      }}
    >
      <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/photos" element={<PhotosManagement />} />
          <Route path="/scanner" element={<MagneticScanner />} />
          <Route path="/validator" element={<UnitValidator />} />
          <Route path="/versions" element={<VersionHistory />} />
        </Routes>
      </Layout>
    </Router>
    </ConfigProvider>
  );
}
