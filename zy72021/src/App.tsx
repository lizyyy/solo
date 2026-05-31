import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import RecordList from "@/pages/RecordList";
import RecordDetail from "@/pages/RecordDetail";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<RecordList />} />
        <Route path="/detail/:id" element={<RecordDetail />} />
      </Routes>
    </Router>
  );
}
