import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import ReplayPage from "@/pages/ReplayPage";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<ReplayPage />} />
      </Routes>
    </Router>
  );
}
