import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import RecordDetail from "@/pages/RecordDetail";
import ImportPage from "@/pages/ImportPage";

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/record/:id" element={<RecordDetail />} />
          <Route path="/import" element={<ImportPage />} />
        </Routes>
      </Layout>
    </Router>
  );
}
