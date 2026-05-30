import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Dashboard from "@/pages/Dashboard";
import BusinessLineDetail from "@/pages/BusinessLineDetail";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/business-line/:id" element={<BusinessLineDetail />} />
      </Routes>
    </Router>
  );
}
