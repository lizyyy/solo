import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import Home from "@/pages/Home";
import Import from "@/pages/Import";
import Workbench from "@/pages/Workbench";
import Conflicts from "@/pages/Conflicts";
import Export from "@/pages/Export";
import Rules from "@/pages/Rules";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/import" element={<Import />} />
          <Route path="/workbench" element={<Workbench />} />
          <Route path="/conflicts" element={<Conflicts />} />
          <Route path="/export" element={<Export />} />
          <Route path="/rules" element={<Rules />} />
        </Route>
      </Routes>
    </Router>
  );
}
