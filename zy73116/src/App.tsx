import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import AppNav from "@/components/AppNav";
import PreReview from "@/pages/PreReview";
import MonthlyReview from "@/pages/MonthlyReview";
import VisaList from "@/pages/VisaList";
import VisaDetail from "@/pages/VisaDetail";
import Report from "@/pages/Report";

export default function App() {
  return (
    <Router>
      <div className="min-h-screen flex flex-col">
        <AppNav />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<PreReview />} />
            <Route path="/review" element={<MonthlyReview />} />
            <Route path="/visa" element={<VisaList />} />
            <Route path="/visa/:visaNo" element={<VisaDetail />} />
            <Route path="/report" element={<Report />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
