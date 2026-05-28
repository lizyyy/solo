import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import VoucherList from "@/pages/VoucherList";
import VoucherDetail from "@/pages/VoucherDetail";
import BalancePage from "@/pages/BalancePage";
import ReportsPage from "@/pages/ReportsPage";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/vouchers" element={<VoucherList />} />
          <Route path="/vouchers/:id" element={<VoucherDetail />} />
          <Route path="/balance" element={<BalancePage />} />
          <Route path="/reports" element={<ReportsPage />} />
        </Route>
      </Routes>
    </Router>
  );
}
