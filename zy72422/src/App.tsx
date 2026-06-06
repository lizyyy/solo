import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import RecordDetail from "@/pages/RecordDetail";
import ImportContract from "@/pages/ImportContract";
import AliasManager from "@/pages/AliasManager";
import ReviewWorkbench from "@/pages/ReviewWorkbench";

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/record/:id" element={<RecordDetail />} />
          <Route path="/import" element={<ImportContract />} />
          <Route path="/aliases" element={<AliasManager />} />
          <Route path="/review" element={<ReviewWorkbench />} />
        </Routes>
      </Layout>
    </Router>
  );
}
