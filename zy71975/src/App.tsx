import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import Home from "@/pages/Home";
import ImportPage from "@/pages/ImportPage";
import ReviewPage from "@/pages/ReviewPage";
import CorrectPage from "@/pages/CorrectPage";
import HistoryPage from "@/pages/HistoryPage";
import ExportPage from "@/pages/ExportPage";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/review" element={<ReviewPage />} />
          <Route path="/correct" element={<CorrectPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/export" element={<ExportPage />} />
        </Route>
      </Routes>
    </Router>
  );
}
