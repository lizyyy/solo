import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import MapPage from "@/pages/MapPage";
import RecordDetailPage from "@/pages/RecordDetailPage";
import HistoryPage from "@/pages/HistoryPage";
import HandoverPage from "@/pages/HandoverPage";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MapPage />} />
        <Route path="/record/:recordId" element={<RecordDetailPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/handover" element={<HandoverPage />} />
      </Routes>
    </Router>
  );
}
