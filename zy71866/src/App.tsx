import { Routes, Route } from 'react-router-dom';
import Layout from '@/components/Layout';
import ImportPage from '@/pages/ImportPage';
import MatrixPage from '@/pages/MatrixPage';
import TracePage from '@/pages/TracePage';
import VersionsPage from '@/pages/VersionsPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<ImportPage />} />
        <Route path="matrix" element={<MatrixPage />} />
        <Route path="trace/:id" element={<TracePage />} />
        <Route path="versions" element={<VersionsPage />} />
      </Route>
    </Routes>
  );
}

export default App;
