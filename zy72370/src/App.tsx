import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Home from "@/pages/Home";
import ThresholdConflict from "@/pages/ThresholdConflict";
import ReviewPage from "@/pages/ReviewPage";
import ConversionPage from "@/pages/ConversionPage";

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-[#0a1929] text-white">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 py-8">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/threshold-conflict" element={<ThresholdConflict />} />
            <Route path="/review" element={<ReviewPage />} />
            <Route path="/conversion" element={<ConversionPage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
