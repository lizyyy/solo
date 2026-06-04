import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Dashboard } from "@/pages/Dashboard";
import { ImportCenter } from "@/pages/ImportCenter";
import { CalculationList } from "@/pages/CalculationList";
import { CalculationDetail } from "@/pages/CalculationDetail";
import { AuditCenter } from "@/pages/AuditCenter";
import { ReviewWorkspace } from "@/pages/ReviewWorkspace";
import { ReviewReport } from "@/pages/ReviewReport";
import Home from "@/pages/Home";

export default function App() {
  return (
    <Router>
      <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="import" element={<ImportCenter />} />
        <Route path="calculations" element={<CalculationList />} />
        <Route path="calculations/:id" element={<CalculationDetail />} />
        <Route path="audit" element={<AuditCenter />} />
        <Route path="review" element={<ReviewWorkspace />} />
        <Route path="report/:id" element={<ReviewReport />} />
      </Route>
      <Route path="/home" element={<Home />} />
      </Routes>
    </Router>
  );
}
