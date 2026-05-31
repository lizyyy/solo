import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Layout from "@/components/Layout";
import Timeline from "@/pages/Timeline";
import Import from "@/pages/Import";
import Analysis from "@/pages/Analysis";
import Review from "@/pages/Review";
import Briefing from "@/pages/Briefing";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/timeline" replace />} />
          <Route path="/timeline" element={<Timeline />} />
          <Route path="/import" element={<Import />} />
          <Route path="/analysis" element={<Analysis />} />
          <Route path="/review" element={<Review />} />
          <Route path="/briefing" element={<Briefing />} />
        </Route>
      </Routes>
    </Router>
  );
}
