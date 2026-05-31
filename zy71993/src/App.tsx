import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from '@/components/Sidebar';
import Workbench from '@/pages/Workbench';
import Issues from '@/pages/Issues';
import History from '@/pages/History';
import Report from '@/pages/Report';

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-navy-900 flex">
        <Sidebar />
        <main className="flex-1 ml-56 p-6">
          <Routes>
            <Route path="/" element={<Workbench />} />
            <Route path="/issues" element={<Issues />} />
            <Route path="/history" element={<History />} />
            <Route path="/report" element={<Report />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
