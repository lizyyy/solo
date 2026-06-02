import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import Home from "@/pages/Home";
import Import from "@/pages/Import";
import Merge from "@/pages/Merge";
import Review from "@/pages/Review";
import Anomalies from "@/pages/Anomalies";
import Export from "@/pages/Export";

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/import" element={<Import />} />
          <Route path="/merge" element={<Merge />} />
          <Route path="/review" element={<Review />} />
          <Route path="/anomalies" element={<Anomalies />} />
          <Route path="/export" element={<Export />} />
        </Routes>
      </Layout>
    </Router>
  );
}
