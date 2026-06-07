import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { RecordsOverview } from "@/pages/RecordsOverview";
import { DataImport } from "@/pages/DataImport";
import { ConflictReview } from "@/pages/ConflictReview";
import { SelfCheckCenter } from "@/pages/SelfCheckCenter";
import { ExportPage } from "@/pages/ExportPage";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<RecordsOverview />} />
          <Route path="/import" element={<DataImport />} />
          <Route path="/conflicts" element={<ConflictReview />} />
          <Route path="/self-check" element={<SelfCheckCenter />} />
          <Route path="/export" element={<ExportPage />} />
        </Route>
      </Routes>
    </Router>
  );
}
