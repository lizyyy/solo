import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Navigation } from "@/components/Navigation";
import { ImportPage } from "@/pages/ImportPage";
import { ComparePage } from "@/pages/ComparePage";
import { AnnotatePage } from "@/pages/AnnotatePage";
import { ExportPage } from "@/pages/ExportPage";

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-synth-bg">
        <Navigation />
        <Routes>
          <Route path="/" element={<ImportPage />} />
          <Route path="/compare" element={<ComparePage />} />
          <Route path="/annotate" element={<AnnotatePage />} />
          <Route path="/export" element={<ExportPage />} />
        </Routes>
      </div>
    </Router>
  );
}
