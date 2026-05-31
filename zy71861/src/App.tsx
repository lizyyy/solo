import { Routes, Route } from 'react-router-dom';
import Layout from '@/components/Layout';
import ImportPage from '@/pages/ImportPage';
import OverviewPage from '@/pages/OverviewPage';
import EvidencePage from '@/pages/EvidencePage';
import ConfirmPage from '@/pages/ConfirmPage';

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<ImportPage />} />
        <Route path="/overview" element={<OverviewPage />} />
        <Route path="/evidence/:id" element={<EvidencePage />} />
        <Route path="/confirm" element={<ConfirmPage />} />
      </Routes>
    </Layout>
  );
}

export default App;
