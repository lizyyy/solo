import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import SettlementList from "@/pages/SettlementList";
import SettlementDetail from "@/pages/SettlementDetail";
import NotFound from "@/pages/NotFound";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/list" replace />} />
        <Route path="/list" element={<SettlementList />} />
        <Route path="/detail/:id" element={<SettlementDetail />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}
