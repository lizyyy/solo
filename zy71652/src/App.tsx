import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import OrderManage from "@/pages/OrderManage";
import Optimize from "@/pages/Optimize";
import Exceptions from "@/pages/Exceptions";

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<OrderManage />} />
          <Route path="/optimize" element={<Optimize />} />
          <Route path="/exceptions" element={<Exceptions />} />
        </Routes>
      </Layout>
    </Router>
  );
}
