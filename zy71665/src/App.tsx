import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import DataEntry from "@/pages/DataEntry";
import Calculation from "@/pages/Calculation";
import History from "@/pages/History";
import ExportPage from "@/pages/Export";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<DataEntry />} />
          <Route path="/calculation" element={<Calculation />} />
          <Route path="/history" element={<History />} />
          <Route path="/export" element={<ExportPage />} />
        </Route>
      </Routes>
    </Router>
  );
}
