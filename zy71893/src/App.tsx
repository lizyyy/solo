import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import RecordDetail from "@/pages/RecordDetail";
import Sidebar from "@/components/Sidebar";

export default function App() {
  return (
    <Router>
      <Sidebar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/record/:id" element={<RecordDetail />} />
      </Routes>
    </Router>
  );
}
