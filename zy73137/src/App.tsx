import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import PlaybackPage from "@/pages/PlaybackPage";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<PlaybackPage />} />
      </Routes>
    </Router>
  );
}
