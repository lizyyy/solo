import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import WarningOverview from "@/pages/WarningOverview";
import WarningDetail from "@/pages/WarningDetail";
import ForemanView from "@/pages/ForemanView";
import OperationHistory from "@/pages/OperationHistory";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<WarningOverview />} />
        <Route path="/warning/:id" element={<WarningDetail />} />
        <Route path="/warning/:id/foreman" element={<ForemanView />} />
        <Route path="/history" element={<OperationHistory />} />
      </Routes>
    </Router>
  );
}
