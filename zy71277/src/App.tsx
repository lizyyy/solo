import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import Analysis from "@/pages/Analysis";
import Reports from "@/pages/Reports";
import ErrorTracking from "@/pages/ErrorTracking";
import Layout from "@/components/Layout";

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/analysis/:id" element={<Analysis />} />
          <Route path="/errors/:id" element={<ErrorTracking />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/other" element={<div className="text-center text-xl">Other Page - Coming Soon</div>} />
        </Routes>
      </Layout>
    </Router>
  );
}
