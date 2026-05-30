import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Header } from './components/common/Header';
import { Sidebar } from './components/common/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { ValuationRecords } from './pages/ValuationRecords';
import { StatusWorkbench } from './pages/StatusWorkbench';

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Header />
        <div className="flex flex-1 min-h-0">
          <Sidebar />
          <main className="flex-1 overflow-hidden">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/records" element={<ValuationRecords />} />
              <Route path="/workbench" element={<StatusWorkbench />} />
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  );
}
