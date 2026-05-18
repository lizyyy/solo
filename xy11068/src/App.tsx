import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import Apply from "@/pages/Apply";
import Review from "@/pages/Review";
import Export from "@/pages/Export";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/apply" element={<Apply />} />
        <Route path="/review/:id" element={<Review />} />
        <Route path="/export" element={<Export />} />
      </Routes>
    </Router>
  );
}
