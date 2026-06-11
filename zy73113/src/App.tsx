import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import PlanList from "@/pages/PlanList";
import PlanDetail from "@/pages/PlanDetail";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<PlanList />} />
        <Route path="/plan/:id" element={<PlanDetail />} />
      </Routes>
    </Router>
  );
}
