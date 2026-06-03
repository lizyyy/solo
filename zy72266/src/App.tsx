import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import Home from "@/pages/Home";
import ImportPage from "@/pages/ImportPage";
import ReviewPage from "@/pages/ReviewPage";
import DisplayPage from "@/pages/DisplayPage";
import AuditPage from "@/pages/AuditPage";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/review" element={<ReviewPage />} />
          <Route path="/display" element={<DisplayPage />} />
          <Route path="/audit" element={<AuditPage />} />
        </Route>
      </Routes>
    </Router>
  );
}
