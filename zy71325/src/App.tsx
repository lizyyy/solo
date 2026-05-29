import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"
import Layout from "@/components/Layout"
import ImportWorkbench from "@/pages/ImportWorkbench"
import AlignmentPanel from "@/pages/AlignmentPanel"
import AnnotatePanel from "@/pages/AnnotatePanel"
import VersionManager from "@/pages/VersionManager"
import ExportPanel from "@/pages/ExportPanel"

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/import" replace />} />
          <Route path="/import" element={<ImportWorkbench />} />
          <Route path="/align" element={<AlignmentPanel />} />
          <Route path="/annotate" element={<AnnotatePanel />} />
          <Route path="/versions" element={<VersionManager />} />
          <Route path="/export" element={<ExportPanel />} />
        </Route>
      </Routes>
    </Router>
  )
}
