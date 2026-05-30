import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { LimitList } from "@/pages/LimitList";
import { LimitDetail } from "@/pages/LimitDetail";
import { LimitEdit } from "@/pages/LimitEdit";
import { ExportList } from "@/pages/ExportList";

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<LimitList />} />
          <Route path="/detail/:id" element={<LimitDetail />} />
          <Route path="/edit/:id" element={<LimitEdit />} />
          <Route path="/export" element={<ExportList />} />
        </Routes>
      </Layout>
    </Router>
  );
}
