import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ProjectsPage } from './pages/ProjectsPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { ReportPage } from './pages/ReportPage';
import { ImportPage } from './pages/ImportPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ProjectsPage />} />
        <Route path="/import" element={<ImportPage />} />
        <Route path="/project/:id" element={<ProjectDetailPage />} />
        <Route path="/project/:id/report" element={<ReportPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
