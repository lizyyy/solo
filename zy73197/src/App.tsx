import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import Workbench from "@/pages/Workbench";
import History from "@/pages/History";
import Samples from "@/pages/Samples";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Workbench />} />
          <Route path="/history" element={<History />} />
          <Route path="/samples" element={<Samples />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
