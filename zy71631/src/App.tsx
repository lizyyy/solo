import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import PlanPage from "@/pages/PlanPage";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/plans" element={<PlanPage />} />
      </Routes>
    </Router>
  );
}
