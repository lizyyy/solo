import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import { TopNav } from "@/components/TopNav";
import ReplayDashboard from "@/pages/ReplayDashboard";
import ImportPanel from "@/pages/ImportPanel";
import JudgmentHistory from "@/pages/JudgmentHistory";
import HandoverGuide from "@/pages/HandoverGuide";
import { useWorkOrderStore } from "@/store/workOrderStore";
import { OrderDetailDrawer } from "@/components/OrderDetailDrawer";

function AppRoutes() {
  const { hydrate } = useWorkOrderStore();
  useEffect(() => { hydrate(); }, [hydrate]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <TopNav />
      <main className="flex-1 flex flex-col">
        <Routes>
          <Route path="/" element={<ReplayDashboard />} />
          <Route path="/import" element={<ImportPanel />} />
          <Route path="/history" element={<JudgmentHistory />} />
          <Route path="/handover" element={<HandoverGuide />} />
          <Route path="*" element={<ReplayDashboard />} />
        </Routes>
      </main>
      <OrderDetailDrawer />
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AppRoutes />
    </Router>
  );
}
