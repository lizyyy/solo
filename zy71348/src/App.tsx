import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Home } from "@/pages/Home";
import { Exceptions } from "@/pages/Exceptions";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/exceptions" element={<Exceptions />} />
      </Routes>
    </Router>
  );
}
