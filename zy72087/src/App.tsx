import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import DataOverview from "@/pages/DataOverview";
import Optimize from "@/pages/Optimize";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<DataOverview />} />
        <Route path="/optimize" element={<Optimize />} />
      </Routes>
    </Router>
  );
}
