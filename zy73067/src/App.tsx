import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import WorkbenchPage from "@/pages/WorkbenchPage";
import FieldMappingPage from "@/pages/FieldMappingPage";
import TempAdjustPage from "@/pages/TempAdjustPage";
import ExportPage from "@/pages/ExportPage";
import HandoverPage from "@/pages/HandoverPage";

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-surface flex flex-col">
        <Navbar />
        <main className="flex-1 px-8 py-6 max-w-[1600px] w-full mx-auto">
          <Routes>
            <Route path="/" element={<Navigate to="/workbench" replace />} />
            <Route path="/workbench" element={<WorkbenchPage />} />
            <Route path="/field-mapping" element={<FieldMappingPage />} />
            <Route path="/temp-adjustment" element={<TempAdjustPage />} />
            <Route path="/export" element={<ExportPage />} />
            <Route path="/handover" element={<HandoverPage />} />
            <Route path="*" element={<Navigate to="/workbench" replace />} />
          </Routes>
        </main>
        <footer className="border-t border-gray-200 bg-white py-3 px-8 text-xs text-gray-400 text-center">
          风机叶片阈值预警复核系统 v1.0 · 维保部专用
        </footer>
      </div>
    </Router>
  );
}
