import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";
import { Dashboard } from "@/pages/Dashboard";
import { EvidenceList } from "@/pages/EvidenceList";
import { EvidenceDetail } from "@/pages/EvidenceDetail";
import { ReviewList } from "@/pages/ReviewList";
import { ImportPage } from "@/pages/ImportPage";
import { ArchivePage } from "@/pages/ArchivePage";

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout><Dashboard /></Layout>} />
        <Route path="/evidence" element={<Layout><EvidenceList /></Layout>} />
        <Route path="/evidence/:id" element={<EvidenceDetail />} />
        <Route path="/review" element={<Layout><ReviewList /></Layout>} />
        <Route path="/import" element={<Layout><ImportPage /></Layout>} />
        <Route path="/archive" element={<Layout><ArchivePage /></Layout>} />
      </Routes>
    </Router>
  );
}
