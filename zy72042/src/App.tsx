import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Header from "@/components/layout/Header";
import ToastContainer from "@/components/feedback/ToastContainer";
import LevelSelect from "@/pages/LevelSelect";
import CafeGame from "@/pages/CafeGame";
import Summary from "@/pages/Summary";
import Supplement from "@/pages/Supplement";
import Conflict from "@/pages/Conflict";
import Guide from "@/pages/Guide";
import History from "@/pages/History";

export default function App() {
  return (
    <Router>
      <Header />
      <ToastContainer />
      <Routes>
        <Route path="/" element={<LevelSelect />} />
        <Route path="/cafe/:levelId" element={<CafeGame />} />
        <Route path="/summary/:sessionId" element={<Summary />} />
        <Route path="/supplement/:sessionId" element={<Supplement />} />
        <Route path="/conflict/:sessionId" element={<Conflict />} />
        <Route path="/guide" element={<Guide />} />
        <Route path="/history" element={<History />} />
      </Routes>
    </Router>
  );
}
