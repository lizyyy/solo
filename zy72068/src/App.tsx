import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import SandtablePage from '@/pages/SandtablePage';
import DataPage from '@/pages/DataPage';
import SchemesPage from '@/pages/SchemesPage';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<SandtablePage />} />
        <Route path="/data" element={<DataPage />} />
        <Route path="/schemes" element={<SchemesPage />} />
      </Routes>
    </Router>
  );
}
