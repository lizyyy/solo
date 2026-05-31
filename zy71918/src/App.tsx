import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import ClipList from "@/pages/ClipList";
import ClipDetail from "@/pages/ClipDetail";
import ClipForm from "@/pages/ClipForm";
import ExportPage from "@/pages/ExportPage";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<ClipList />} />
          <Route path="clip/new" element={<ClipForm />} />
          <Route path="clip/:id" element={<ClipDetail />} />
          <Route path="clip/:id/edit" element={<ClipForm />} />
          <Route path="export" element={<ExportPage />} />
        </Route>
      </Routes>
    </Router>
  );
}
