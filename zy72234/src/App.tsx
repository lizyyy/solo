import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import ImportBoard from "@/pages/ImportBoard";
import ClearingOverview from "@/pages/ClearingOverview";
import AdjustmentList from "@/pages/AdjustmentList";
import AdjustmentDetail from "@/pages/AdjustmentDetail";
import CustodyConfirm from "@/pages/CustodyConfirm";
import ExecutiveSummary from "@/pages/ExecutiveSummary";
import ReviewDesk from "@/pages/ReviewDesk";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="import" element={<ImportBoard />} />
          <Route path="overview" element={<ClearingOverview />} />
          <Route path="adjustments" element={<AdjustmentList />} />
          <Route path="adjustments/:id" element={<AdjustmentDetail />} />
          <Route path="custody" element={<CustodyConfirm />} />
          <Route path="custody/:id" element={<CustodyConfirm />} />
          <Route path="summary" element={<ExecutiveSummary />} />
          <Route path="review" element={<ReviewDesk />} />
        </Route>
      </Routes>
    </Router>
  );
}
