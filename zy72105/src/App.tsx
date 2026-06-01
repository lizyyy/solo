import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Navbar } from './components/common/Navbar';
import { Workbench } from './pages/Workbench';
import { HistoryCompare } from './pages/HistoryCompare';
import { ReportPreview } from './pages/ReportPreview';
import { Settings } from './pages/Settings';

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-slate-100">
        <Navbar />
        <Routes>
          <Route path="/" element={<Workbench />} />
          <Route path="/history" element={<HistoryCompare />} />
          <Route path="/report/:batchId?" element={<ReportPreview />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </div>
    </Router>
  );
}
