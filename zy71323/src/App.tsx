import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import Home from "@/pages/Home";
import EstimationPage from "@/pages/EstimationPage";
import RecordsPage from "@/pages/RecordsPage";
import ComparePage from "@/pages/ComparePage";

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/estimate" element={<EstimationPage />} />
          <Route path="/records" element={<RecordsPage />} />
          <Route path="/compare" element={<ComparePage />} />
        </Routes>
      </Layout>
    </Router>
  );
}
