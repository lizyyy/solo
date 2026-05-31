import React from 'react';
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import HomePage from "@/pages/HomePage";
import DetailPage from "@/pages/DetailPage";
import ExportPage from "@/pages/ExportPage";
import { useArchiveStore } from './store/archiveStore';

function AppInitializer({ children }: { children: React.ReactNode }) {
  const init = useArchiveStore(s => s.init);
  
  React.useEffect(() => {
    init();
  }, [init]);

  return <>{children}</>;
}

export default function App() {
  return (
    <Router>
      <AppInitializer>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/archive/:id" element={<DetailPage />} />
          <Route path="/export" element={<ExportPage />} />
        </Routes>
      </AppInitializer>
    </Router>
  );
}
