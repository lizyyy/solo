import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import TrackList from "@/pages/TrackList";
import TrackDetail from "@/pages/TrackDetail";
import History from "@/pages/History";
import Guide from "@/pages/Guide";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<TrackList />} />
          <Route path="track/:id" element={<TrackDetail />} />
          <Route path="history" element={<History />} />
          <Route path="guide" element={<Guide />} />
        </Route>
      </Routes>
    </Router>
  );
}
