import { Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { ImportPage } from '@/pages/ImportPage';
import { TimelinePage } from '@/pages/TimelinePage';
import { ExportPage } from '@/pages/ExportPage';

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<ImportPage />} />
        <Route path="/timeline" element={<TimelinePage />} />
        <Route path="/export" element={<ExportPage />} />
      </Routes>
    </Layout>
  );
}

export default App;
