import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { ToastContainer } from "@/components/Toast";
import Dashboard from "@/pages/Dashboard";
import ThresholdNotes from "@/pages/ThresholdNotes";
import Experiments from "@/pages/Experiments";
import Anomalies from "@/pages/Anomalies";
import History from "@/pages/History";

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/notes" element={<ThresholdNotes />} />
          <Route path="/experiments" element={<Experiments />} />
          <Route path="/anomalies" element={<Anomalies />} />
          <Route path="/history" element={<History />} />
        </Routes>
      </Layout>
      <ToastContainer />
    </Router>
  );
}
