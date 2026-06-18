import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import Logs from "@/pages/Logs";
import Import from "@/pages/Import";
import Queue from "@/pages/Queue";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/logs" element={<Logs />} />
        <Route path="/import" element={<Import />} />
        <Route path="/queue" element={<Queue />} />
      </Routes>
    </Router>
  );
}
