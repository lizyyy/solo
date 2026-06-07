import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import Points from "@/pages/Points";
import Conflicts from "@/pages/Conflicts";
import SelfCheck from "@/pages/SelfCheck";
import Workflow from "@/pages/Workflow";
import History from "@/pages/History";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/points" element={<Points />} />
          <Route path="/conflicts" element={<Conflicts />} />
          <Route path="/self-check" element={<SelfCheck />} />
          <Route path="/workflow" element={<Workflow />} />
          <Route path="/history" element={<History />} />
        </Route>
      </Routes>
    </Router>
  );
}
