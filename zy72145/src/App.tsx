import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import TrackVerificationPage from "@/pages/TrackVerificationPage";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<TrackVerificationPage />} />
      </Routes>
    </Router>
  );
}
