import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Workbench } from "@/pages/Workbench";
import { About } from "@/pages/About";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Workbench />} />
        <Route path="/about" element={<About />} />
      </Routes>
    </Router>
  );
}
