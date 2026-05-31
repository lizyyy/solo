import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import Kanban from "@/pages/Kanban";
import RecordDetail from "@/pages/RecordDetail";
import Submit from "@/pages/Submit";
import Audit from "@/pages/Audit";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Kanban />} />
          <Route path="/record/:id" element={<RecordDetail />} />
          <Route path="/submit" element={<Submit />} />
          <Route path="/audit" element={<Audit />} />
        </Route>
      </Routes>
    </Router>
  );
}
