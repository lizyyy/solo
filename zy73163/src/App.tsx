import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import ChartAnomaly from "@/pages/ChartAnomaly";
import NotesMaterials from "@/pages/NotesMaterials";
import QuarantineTrace from "@/pages/QuarantineTrace";
import Handover from "@/pages/Handover";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<ChartAnomaly />} />
          <Route path="/notes" element={<NotesMaterials />} />
          <Route path="/quarantine" element={<QuarantineTrace />} />
          <Route path="/handover" element={<Handover />} />
        </Route>
      </Routes>
    </Router>
  );
}
