import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import List from "@/pages/List";
import Detail from "@/pages/Detail";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<List />} />
        <Route path="/detail/:id" element={<Detail />} />
      </Routes>
    </Router>
  );
}
