import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAppStore } from '@/store';
import Layout from '@/components/Layout';
import ProjectList from '@/pages/ProjectList';
import ProjectDetail from '@/pages/ProjectDetail';
import DeviceRemarks from '@/pages/DeviceRemarks';
import CADPoints from '@/pages/CADPoints';
import SightAnalysis from '@/pages/SightAnalysis';
import Inspection from '@/pages/Inspection';
import InspectionShare from '@/pages/InspectionShare';

function App() {
  const { initialize, loadProjects } = useAppStore();

  useEffect(() => {
    const init = async () => {
      await initialize();
      await loadProjects();
    };
    init();
  }, [initialize, loadProjects]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/projects" replace />} />
          <Route path="projects" element={<ProjectList />} />
          <Route path="projects/:id" element={<ProjectDetail />} />
          <Route path="projects/:id/device-remarks" element={<DeviceRemarks />} />
          <Route path="projects/:id/cad-points" element={<CADPoints />} />
          <Route path="projects/:id/sight-analysis" element={<SightAnalysis />} />
          <Route path="projects/:id/inspection" element={<Inspection />} />
        </Route>
        <Route path="/inspection/:shareId" element={<InspectionShare />} />
        <Route path="*" element={<Navigate to="/projects" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
