import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Sidebar } from '@/components/common/Sidebar';
import { ScenePage } from '@/pages/ScenePage';
import { RecordsPage } from '@/pages/RecordsPage';
import { RecordDetailPage } from '@/pages/RecordDetailPage';
import { ExportPage } from '@/pages/ExportPage';
import '@/index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <div className="flex min-h-screen bg-slate-100">
        <Sidebar />
        <main className="flex-1 ml-64">
          <Routes>
            <Route path="/" element={<ScenePage />} />
            <Route path="/records" element={<RecordsPage />} />
            <Route path="/records/:id" element={<RecordDetailPage />} />
            <Route path="/export" element={<ExportPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  </React.StrictMode>
);
