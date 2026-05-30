import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Home from "@/pages/Home";
import Calculator from "@/pages/Calculator";
import Charts from "@/pages/Charts";
import History from "@/pages/History";
import ResultDetail from "@/pages/ResultDetail";

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/calculator" element={<Calculator />} />
          <Route path="/calculator/:id" element={<Calculator />} />
          <Route path="/charts" element={<Charts />} />
          <Route path="/history" element={<History />} />
          <Route path="/result/:id" element={<ResultDetail />} />
        </Routes>
      </div>
    </Router>
  );
}
