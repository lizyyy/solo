import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import Export from "@/pages/Export";
import History from "@/pages/History";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/export" element={<Export />} />
        <Route path="/history" element={<History />} />
      </Routes>
    </Router>
  );
}
