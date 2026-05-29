import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ProjectList } from "@/pages/ProjectList";
import { Workbench } from "@/pages/Workbench";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<ProjectList />} />
        <Route path="/workbench/:pageId" element={<Workbench />} />
      </Routes>
    </Router>
  );
}
