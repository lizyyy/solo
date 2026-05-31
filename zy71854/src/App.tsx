import { Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { DataPage } from '@/pages/DataPage';
import { OrbitPage } from '@/pages/OrbitPage';
import { RecordsPage } from '@/pages/RecordsPage';
import { GuidePage } from '@/pages/GuidePage';

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<DataPage />} />
        <Route path="/orbit" element={<OrbitPage />} />
        <Route path="/records" element={<RecordsPage />} />
        <Route path="/guide" element={<GuidePage />} />
      </Route>
    </Routes>
  );
}

export default App;
