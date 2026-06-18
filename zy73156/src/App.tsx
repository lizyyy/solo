import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import TopBar from "@/components/layout/TopBar";
import Drift from "@/pages/Drift";
import History from "@/pages/History";
import Home from "@/pages/Home";

export default function App() {
  return (
    <Router>
      <div className="flex h-full flex-col">
        <TopBar />
        <main className="flex min-h-0 flex-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/history" element={<History />} />
            <Route path="/drift" element={<Drift />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
