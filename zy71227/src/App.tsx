import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import Home from "@/pages/Home";
import Artworks from "@/pages/Artworks";
import Curation from "@/pages/Curation";
import Auction from "@/pages/Auction";
import Settlement from "@/pages/Settlement";
import Report from "@/pages/Report";

export default function App() {
  return (
    <Router>
      <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/artworks" element={<Artworks />} />
        <Route path="/curation" element={<Curation />} />
        <Route path="/auction" element={<Auction />} />
        <Route path="/settlement" element={<Settlement />} />
        <Route path="/report" element={<Report />} />
      </Route>
      </Routes>
    </Router>
  );
}
