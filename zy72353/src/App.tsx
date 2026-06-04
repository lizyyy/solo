import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import Home from "@/pages/Home";
import ThresholdDetail from "@/pages/ThresholdDetail";
import Visualization from "@/pages/Visualization";
import Workflow from "@/pages/Workflow";
import Reports from "@/pages/Reports";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/threshold/:id" element={<ThresholdDetail />} />
          <Route path="/visualization" element={<Visualization />} />
          <Route path="/workflow" element={<Workflow />} />
          <Route path="/report" element={<Reports />} />
        </Route>
      </Routes>
    </Router>
  );
}
