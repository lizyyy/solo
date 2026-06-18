import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Dashboard from "@/pages/Dashboard";
import AnnotationDetail from "@/pages/AnnotationDetail";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/annotations/:id" element={<AnnotationDetail />} />
      </Routes>
    </Router>
  );
}
