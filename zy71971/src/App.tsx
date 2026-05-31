import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import QAList from "@/pages/QAList";
import Review from "@/pages/Review";
import ImportManagement from "@/pages/ImportManagement";
import Report from "@/pages/Report";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/qa" element={<QAList />} />
          <Route path="/review" element={<Review />} />
          <Route path="/import" element={<ImportManagement />} />
          <Route path="/report" element={<Report />} />
        </Route>
      </Routes>
    </Router>
  );
}
