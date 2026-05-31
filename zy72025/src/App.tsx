import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import History from "@/pages/History";
import Import from "@/pages/Import";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/history" element={<History />} />
        <Route path="/import" element={<Import />} />
      </Routes>
    </Router>
  );
}
