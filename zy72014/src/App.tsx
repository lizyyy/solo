import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import SettlementList from "@/pages/SettlementList";
import SettlementDetail from "@/pages/SettlementDetail";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<SettlementList />} />
        <Route path="/settlement/:id" element={<SettlementDetail />} />
      </Routes>
    </Router>
  );
}
