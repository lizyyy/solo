import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import RecordList from "@/pages/RecordList";
import RecordDetail from "@/pages/RecordDetail";
import WeeklyReport from "@/pages/WeeklyReport";

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<RecordList />} />
          <Route path="/record/:id" element={<RecordDetail />} />
          <Route path="/weekly-report" element={<WeeklyReport />} />
        </Routes>
      </Layout>
    </Router>
  );
}
