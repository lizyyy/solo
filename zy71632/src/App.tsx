import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Classroom from "@/pages/Classroom";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Classroom />} />
      </Routes>
    </Router>
  );
}
