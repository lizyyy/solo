import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Simulator from "@/pages/Simulator";
import Samples from "@/pages/Samples";
import Detail from "@/pages/Detail";
import Audit from "@/pages/Audit";

export default function App() {
  return (
    <Router>
      <div className="flex min-h-screen bg-brand-bg font-body">
        <Navigation />
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<Simulator />} />
            <Route path="/samples" element={<Samples />} />
            <Route path="/detail/:id" element={<Detail />} />
            <Route path="/audit" element={<Audit />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
