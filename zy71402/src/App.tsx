import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Dashboard from "@/pages/Dashboard";
import BatchDetail from "@/pages/BatchDetail";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/batch/:batchId" element={<BatchDetail />} />
      </Routes>
    </Router>
  );
}
