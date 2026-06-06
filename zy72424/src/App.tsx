import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import Contracts from "@/pages/Contracts";
import TrackAliases from "@/pages/TrackAliases";
import Statistics from "@/pages/Statistics";
import Statistics3D from "@/pages/Statistics3D";
import History from "@/pages/History";
import Review from "@/pages/Review";
import Rules from "@/pages/Rules";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/contracts" element={<Contracts />} />
          <Route path="/aliases" element={<TrackAliases />} />
          <Route path="/statistics" element={<Statistics />} />
          <Route path="/statistics/3d" element={<Statistics3D />} />
          <Route path="/history" element={<History />} />
          <Route path="/review" element={<Review />} />
          <Route path="/rules" element={<Rules />} />
        </Route>
      </Routes>
    </Router>
  );
}
