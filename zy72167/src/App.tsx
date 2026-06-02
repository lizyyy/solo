import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import Dashboard from "@/pages/Dashboard";
import Import from "@/pages/Import";
import Merge from "@/pages/Merge";
import Review from "@/pages/Review";
import MapView from "@/pages/MapView";
import Export from "@/pages/Export";
import Supplement from "@/pages/Supplement";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/import" element={<Import />} />
          <Route path="/merge" element={<Merge />} />
          <Route path="/review" element={<Review />} />
          <Route path="/map" element={<MapView />} />
          <Route path="/export" element={<Export />} />
          <Route path="/supplement" element={<Supplement />} />
        </Route>
      </Routes>
    </Router>
  );
}
