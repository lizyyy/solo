import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import Home from "@/pages/Home";
import Entry from "@/pages/Entry";
import Process from "@/pages/Process";
import Review from "@/pages/Review";
import ExportPage from "@/pages/Export";

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/entry" element={<Entry />} />
          <Route path="/process" element={<Process />} />
          <Route path="/review" element={<Review />} />
          <Route path="/export" element={<ExportPage />} />
        </Routes>
      </Layout>
    </Router>
  );
}
