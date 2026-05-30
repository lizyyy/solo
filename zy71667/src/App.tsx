import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import NavBar from "@/components/NavBar";
import Workspace from "@/pages/Workspace";
import History from "@/pages/History";

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-drum-bg font-body">
        <NavBar />
        <Routes>
          <Route path="/" element={<Workspace />} />
          <Route path="/history" element={<History />} />
        </Routes>
      </div>
    </Router>
  );
}
