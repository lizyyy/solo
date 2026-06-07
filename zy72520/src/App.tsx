import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import ListPage from "@/pages/ListPage";
import DetailPage from "@/pages/DetailPage";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<ListPage />} />
          <Route path="/review/:id" element={<DetailPage />} />
          <Route path="/dashboard" element={<div className="card text-center py-20"><h2 className="text-xl text-gray-500">数据统计 - 建设中</h2></div>} />
          <Route path="/settings" element={<div className="card text-center py-20"><h2 className="text-xl text-gray-500">参数设置 - 建设中</h2></div>} />
        </Route>
      </Routes>
    </Router>
  );
}
