import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import Settlement from "@/pages/Settlement";
import Import from "@/pages/Import";
import Supplement from "@/pages/Supplement";
import History from "@/pages/History";
import Help from "@/pages/Help";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/settlement/:sessionId" element={<Settlement />} />
        <Route path="/import" element={<Import />} />
        <Route path="/supplement/:sessionId" element={<Supplement />} />
        <Route path="/history" element={<History />} />
        <Route path="/help" element={<Help />} />
      </Routes>
    </Router>
  );
}
