import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import Presets from "@/pages/Presets";
import Compatibility from "@/pages/Compatibility";
import Pedals from "@/pages/Pedals";
import ImportExport from "@/pages/ImportExport";
import { useStore } from "@/store";
import { useEffect } from "react";

export default function App() {
  const runCompatibility = useStore((s) => s.runCompatibility);

  useEffect(() => {
    runCompatibility();
  }, [runCompatibility]);

  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/presets" element={<Presets />} />
          <Route path="/compatibility" element={<Compatibility />} />
          <Route path="/pedals" element={<Pedals />} />
          <Route path="/io" element={<ImportExport />} />
        </Route>
      </Routes>
    </Router>
  );
}
