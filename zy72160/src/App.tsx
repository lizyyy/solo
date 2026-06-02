import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import DataImport from "@/pages/DataImport";
import Review from "@/pages/Review";
import ReviewDetail from "@/pages/ReviewDetail";
import ExportList from "@/pages/ExportList";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/import" element={<DataImport />} />
          <Route path="/review" element={<Review />} />
          <Route path="/review/:id" element={<ReviewDetail />} />
          <Route path="/export" element={<ExportList />} />
        </Route>
      </Routes>
    </Router>
  );
}
