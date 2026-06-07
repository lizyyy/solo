import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Layout } from "@/components/Layout";
import Home from "@/pages/Home";
import Import from "@/pages/Import";
import Heatmap from "@/pages/Heatmap";
import Conflicts from "@/pages/Conflicts";
import SelfCheck from "@/pages/SelfCheck";
import History from "@/pages/History";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/import" element={<Import />} />
          <Route path="/heatmap" element={<Heatmap />} />
          <Route path="/conflicts" element={<Conflicts />} />
          <Route path="/self-check" element={<SelfCheck />} />
          <Route path="/history" element={<History />} />
        </Route>
      </Routes>
    </Router>
  );
}
