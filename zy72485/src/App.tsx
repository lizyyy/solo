import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import Home from "@/pages/Home";
import Notices from "@/pages/Notices";
import Ramps from "@/pages/Ramps";
import Points from "@/pages/Points";
import Review from "@/pages/Review";
import Visualization from "@/pages/Visualization";
import History from "@/pages/History";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="notices" element={<Notices />} />
          <Route path="ramps" element={<Ramps />} />
          <Route path="points" element={<Points />} />
          <Route path="review" element={<Review />} />
          <Route path="visualization" element={<Visualization />} />
          <Route path="history" element={<History />} />
        </Route>
      </Routes>
    </Router>
  );
}
