import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import ImportPage from '@/pages/ImportPage';
import WorkspacePage from '@/pages/WorkspacePage';
import ReviewPage from '@/pages/ReviewPage';
import ComparePage from '@/pages/ComparePage';
import ExportPage from '@/pages/ExportPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/import" replace />} />
          <Route path="import" element={<ImportPage />} />
          <Route path="workspace" element={<WorkspacePage />} />
          <Route path="review" element={<ReviewPage />} />
          <Route path="compare" element={<ComparePage />} />
          <Route path="export" element={<ExportPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
