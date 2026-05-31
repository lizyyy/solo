import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Home from "@/pages/Home";
import Timeline from "@/pages/Timeline";
import Checklist from "@/pages/Checklist";
import Export from "@/pages/Export";
import { useProjectStore } from "@/store/projectStore";

export default function App() {
  const { currentProject } = useProjectStore();

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/project/:id" element={<Timeline />} />
        <Route path="/project/:id/checklist" element={<Checklist />} />
        <Route path="/project/:id/export" element={<Export />} />
        <Route path="/timeline" element={currentProject ? <Navigate to={`/project/${currentProject.id}`} /> : <Navigate to="/" />} />
        <Route path="/checklist" element={currentProject ? <Navigate to={`/project/${currentProject.id}/checklist`} /> : <Navigate to="/" />} />
        <Route path="/export" element={currentProject ? <Navigate to={`/project/${currentProject.id}/export`} /> : <Navigate to="/" />} />
      </Routes>
    </Router>
  );
}
