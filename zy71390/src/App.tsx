import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import RuleList from "@/pages/RuleList";
import RuleDetail from "@/pages/RuleDetail";
import RuleForm from "@/pages/RuleForm";
import ShadowDrill from "@/pages/ShadowDrill";
import CustomerList from "@/pages/CustomerList";
import ReportList from "@/pages/ReportList";
import ReportDetail from "@/pages/ReportDetail";
import Settings from "@/pages/Settings";

function NotFound() {
  return (
    <div className="card p-8 text-center">
      <h2 className="text-2xl font-bold text-white mb-4">404 - 页面不存在</h2>
      <p className="text-slate-400">您访问的页面不存在或已被移除。</p>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="rules" element={<RuleList />} />
          <Route path="rules/new" element={<RuleForm />} />
          <Route path="rules/:id" element={<RuleDetail />} />
          <Route path="shadow" element={<ShadowDrill />} />
          <Route path="customers" element={<CustomerList />} />
          <Route path="reports" element={<ReportList />} />
          <Route path="reports/:id" element={<ReportDetail />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Router>
  );
}
