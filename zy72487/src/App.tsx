import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import RecordList from "@/pages/RecordList";
import RecordDetail from "@/pages/RecordDetail";
import ConflictPage from "@/pages/ConflictPage";
import SelfCheckPage from "@/pages/SelfCheckPage";
import ExportPage from "@/pages/ExportPage";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<RecordList />} />
          <Route path="/record/:id" element={<RecordDetail />} />
          <Route path="/conflict/:id" element={<ConflictPage />} />
          <Route path="/self-check" element={<SelfCheckPage />} />
          <Route path="/export" element={<ExportPage />} />
        </Route>
      </Routes>
    </Router>
  );
}
