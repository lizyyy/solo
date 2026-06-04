import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import Home from "@/pages/Home";
import ImportPage from "@/pages/Import";
import Review from "@/pages/Review";
import Selfcheck from "@/pages/Selfcheck";
import Audit from "@/pages/Audit";
import ExportPage from "@/pages/Export";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/review" element={<Review />} />
          <Route path="/selfcheck" element={<Selfcheck />} />
          <Route path="/audit" element={<Audit />} />
          <Route path="/export" element={<ExportPage />} />
        </Route>
      </Routes>
    </Router>
  );
}
