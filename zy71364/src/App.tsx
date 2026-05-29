import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import Artworks from "@/pages/Artworks";
import ArtworkDetail from "@/pages/ArtworkDetail";
import RestorationDetail from "@/pages/RestorationDetail";
import Reports from "@/pages/Reports";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/artworks" element={<Artworks />} />
          <Route path="/artworks/:id" element={<ArtworkDetail />} />
          <Route path="/restorations/:id" element={<RestorationDetail />} />
          <Route path="/reports" element={<Reports />} />
        </Route>
      </Routes>
    </Router>
  );
}
