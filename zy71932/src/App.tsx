import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import FontList from "@/pages/FontList";
import ImportPage from "@/pages/Import";
import ExportPage from "@/pages/Export";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/fonts" element={<FontList />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/export" element={<ExportPage />} />
        </Route>
      </Routes>
    </Router>
  );
}
