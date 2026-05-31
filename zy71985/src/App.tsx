import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import { useAppStore } from "@/store";
import Sidebar from "@/components/Sidebar";
import Dashboard from "@/pages/Dashboard";
import Records from "@/pages/Records";
import RecordDetail from "@/pages/RecordDetail";
import Review from "@/pages/Review";
import History from "@/pages/History";
import Export from "@/pages/Export";

export default function App() {
  const init = useAppStore(state => state.init);

  useEffect(() => {
    init();
  }, [init]);

  return (
    <Router>
      <div className="min-h-screen bg-slate-950">
        <Sidebar />
        <main className="ml-64 min-h-screen">
          <div className="p-8 max-w-[1600px] mx-auto">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/records" element={<Records />} />
              <Route path="/records/:id" element={<RecordDetail />} />
              <Route path="/review" element={<Review />} />
              <Route path="/history" element={<History />} />
              <Route path="/export" element={<Export />} />
            </Routes>
          </div>
        </main>
      </div>
    </Router>
  );
}
