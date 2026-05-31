import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import RecordsList from "@/pages/RecordsList";
import RecordDetail from "@/pages/RecordDetail";
import DataImport from "@/pages/DataImport";
import FlightReview from "@/pages/FlightReview";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/records" element={<RecordsList />} />
          <Route path="/records/:id" element={<RecordDetail />} />
          <Route path="/import" element={<DataImport />} />
          <Route path="/review" element={<FlightReview />} />
        </Route>
      </Routes>
    </Router>
  );
}
