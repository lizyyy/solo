import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Layout } from "@/components/Layout/Layout";
import Home from "@/pages/Home/Home";
import SampleDetail from "@/pages/SampleDetail/SampleDetail";
import Review from "@/pages/Review/Review";
import History from "@/pages/History/History";
import Conflicts from "@/pages/Conflicts/Conflicts";

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/sample/:id" element={<SampleDetail />} />
          <Route path="/review" element={<Review />} />
          <Route path="/history" element={<History />} />
          <Route path="/conflicts" element={<Conflicts />} />
        </Routes>
      </Layout>
    </Router>
  );
}
