import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import RulesManagement from "@/pages/RulesManagement";
import BatchesManagement from "@/pages/BatchesManagement";
import ReviewDetail from "@/pages/ReviewDetail";
import Visualization from "@/pages/Visualization";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/rules" element={<RulesManagement />} />
          <Route path="/batches" element={<BatchesManagement />} />
          <Route path="/review/:id" element={<ReviewDetail />} />
          <Route path="/visualization" element={<Visualization />} />
        </Route>
      </Routes>
    </Router>
  );
}
