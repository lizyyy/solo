import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Console } from "@/pages/Console";
import { Drafts } from "@/pages/Drafts";
import { Timeline } from "@/pages/Timeline";
import { Anomalies } from "@/pages/Anomalies";
import { Export } from "@/pages/Export";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Console />} />
          <Route path="/drafts" element={<Drafts />} />
          <Route path="/timeline" element={<Timeline />} />
          <Route path="/anomalies" element={<Anomalies />} />
          <Route path="/export" element={<Export />} />
        </Route>
      </Routes>
    </Router>
  );
}
