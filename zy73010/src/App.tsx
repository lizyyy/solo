import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/Layout.js';
import { ToastContainer } from '@/components/ToastContainer.js';
import DashboardPage from '@/pages/DashboardPage.js';
import RecordDetailPage from '@/pages/RecordDetailPage.js';
import ExceptionQueuePage from '@/pages/ExceptionQueuePage.js';
import ExportCenterPage from '@/pages/ExportCenterPage.js';

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/record/:id" element={<RecordDetailPage />} />
          <Route path="/exceptions" element={<ExceptionQueuePage />} />
          <Route path="/export" element={<ExportCenterPage />} />
          <Route path="*" element={<DashboardPage />} />
        </Routes>
      </Layout>
      <ToastContainer />
    </BrowserRouter>
  );
}

export default App;
