import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import Layout from "@/components/Layout";
import PointsPage from "@/pages/PointsPage";
import ImportPage from "@/pages/ImportPage";
import ReviewPage from "@/pages/ReviewPage";
import ExportPage from "@/pages/ExportPage";
import LogsPage from "@/pages/LogsPage";
import HelpPage from "@/pages/HelpPage";
import { useAppStore } from "@/store";

export default function App() {
  const { init, loading } = useAppStore();

  useEffect(() => {
    init();
  }, [init]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-neutral-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-neutral-500">系统加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<PointsPage />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/review" element={<ReviewPage />} />
          <Route path="/export" element={<ExportPage />} />
          <Route path="/logs" element={<LogsPage />} />
          <Route path="/help" element={<HelpPage />} />
        </Routes>
      </Layout>
    </Router>
  );
}
