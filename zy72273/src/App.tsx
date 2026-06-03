import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Dashboard from "@/pages/Dashboard";
import RecordDetail from "@/pages/RecordDetail";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/record/:id" element={<RecordDetail />} />
      </Routes>
    </Router>
  );
}
