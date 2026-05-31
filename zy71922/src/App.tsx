import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from '@/components/Sidebar';
import Inventory from '@/pages/Inventory';
import ArtworkDetail from '@/pages/ArtworkDetail';
import ImportPage from '@/pages/ImportPage';
import ExportPage from '@/pages/ExportPage';

export default function App() {
  return (
    <Router>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 ml-48 transition-all duration-300">
          <Routes>
            <Route path="/" element={<Inventory />} />
            <Route path="/artwork/:id" element={<ArtworkDetail />} />
            <Route path="/import" element={<ImportPage />} />
            <Route path="/export" element={<ExportPage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
