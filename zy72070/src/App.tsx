import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ImportPage } from '@/pages/ImportPage';
import { WorkspacePage } from '@/pages/WorkspacePage';
import { ReportPage } from '@/pages/ReportPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<ImportPage />} />
        <Route path="/workspace" element={<WorkspacePage />} />
        <Route path="/report" element={<ReportPage />} />
      </Routes>
    </Router>
  );
}

export default App;
