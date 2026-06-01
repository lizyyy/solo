import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { HomePage } from "@/pages/HomePage";
import { ProjectPage } from "@/pages/ProjectPage";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/project/:id" element={<ProjectPage />} />
      </Routes>
    </Router>
  );
}
