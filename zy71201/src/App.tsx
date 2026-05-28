import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import Home from "@/pages/Home";
import ProductDetail from "@/pages/ProductDetail";
import History from "@/pages/History";
import Import from "@/pages/Import";
import Export from "@/pages/Export";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout><Home /></Layout>} />
        <Route path="/product/:id" element={<Layout><ProductDetail /></Layout>} />
        <Route path="/product/:id/history" element={<Layout><History /></Layout>} />
        <Route path="/import" element={<Layout><Import /></Layout>} />
        <Route path="/export" element={<Layout><Export /></Layout>} />
      </Routes>
    </Router>
  );
}
