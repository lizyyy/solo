import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import Overview from "@/pages/Overview";
import Detail from "@/pages/Detail";
import Audit from "@/pages/Audit";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Overview />} />
          <Route path="/detail/:id" element={<Detail />} />
          <Route path="/audit" element={<Audit />} />
        </Route>
      </Routes>
    </Router>
  );
}
