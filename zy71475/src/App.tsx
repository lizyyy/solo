import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import Workbench from "@/pages/Workbench";
import Records from "@/pages/Records";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Workbench />} />
          <Route path="/records" element={<Records />} />
        </Route>
      </Routes>
    </Router>
  );
}
