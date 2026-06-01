import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import PageContainer from "@/components/layout/PageContainer";
import Dashboard from "@/pages/Dashboard";
import Analysis from "@/pages/Analysis";
import Comparison from "@/pages/Comparison";

export default function App() {
  return (
    <Router>
      <PageContainer>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/analysis" element={<Analysis />} />
          <Route path="/comparison" element={<Comparison />} />
        </Routes>
      </PageContainer>
    </Router>
  );
}
