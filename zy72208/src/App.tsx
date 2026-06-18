import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Home } from "./pages/Home.js";
import { ImportPage } from "./pages/ImportPage.js";
import { BatchDetailPage } from "./pages/BatchDetailPage.js";
import { ReplayPage } from "./pages/ReplayPage.js";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/import" element={<ImportPage />} />
        <Route path="/batch/:id" element={<BatchDetailPage />} />
        <Route path="/replay" element={<ReplayPage />} />
      </Routes>
    </Router>
  );
}
