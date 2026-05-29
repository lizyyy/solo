import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Sidebar } from '@/components/Sidebar'
import { ProjectList } from '@/pages/ProjectList'
import { ProjectDetail } from '@/pages/ProjectDetail'
import { ProjectEdit } from '@/pages/ProjectEdit'
import { VersionCompare } from '@/pages/VersionCompare'
import { HistoryExport } from '@/pages/HistoryExport'
import '@/index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<ProjectList />} />
          <Route path="/project/:id" element={<ProjectDetail />} />
          <Route path="/project/:id/edit" element={<ProjectEdit />} />
          <Route path="/project/:id/compare" element={<VersionCompare />} />
          <Route path="/project/:id/history" element={<HistoryExport />} />
        </Routes>
      </main>
    </BrowserRouter>
  </React.StrictMode>
)
