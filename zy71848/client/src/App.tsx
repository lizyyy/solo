import { Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import InspectionDetail from './pages/InspectionDetail';
import BatchProcessing from './pages/BatchProcessing';
import ExportManagement from './pages/ExportManagement';
import Settings from './pages/Settings';

function App() {
  return (
    <div className="flex h-screen bg-slate-100">
      <Sidebar />
      <div className="flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/inspection/:id" element={<InspectionDetail />} />
          <Route path="/batch" element={<BatchProcessing />} />
          <Route path="/export" element={<ExportManagement />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;
