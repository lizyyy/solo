import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import ExperimentDetail from "@/pages/ExperimentDetail";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/experiment/:id" element={<ExperimentDetail />} />
      </Routes>
    </Router>
  );
}
