import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import Settlements from "@/pages/Settlements";
import ImportCenter from "@/pages/ImportCenter";
import ExportCenter from "@/pages/ExportCenter";
import History from "@/pages/History";
import Toast from "@/components/Toast";

export default function App() {
  return (
    <Router>
      <Toast />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/settlements" element={<Settlements />} />
          <Route path="/import" element={<ImportCenter />} />
          <Route path="/export" element={<ExportCenter />} />
          <Route path="/history" element={<History />} />
        </Route>
      </Routes>
    </Router>
  );
}
