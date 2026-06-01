import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Home from "@/pages/Home";
import DataImportPage from "@/pages/DataImportPage";
import PreprocessPage from "@/pages/PreprocessPage";
import FittingPage from "@/pages/FittingPage";
import ReportPage from "@/pages/ReportPage";
import HistoryPage from "@/pages/HistoryPage";
import { useDataStore } from "@/store/dataStore";

function AppRoutes() {
  const { currentStep, rawData, processedData, fittingResult } = useDataStore();

  const getDefaultRoute = () => {
    if (fittingResult) return '/report';
    if (processedData.length > 0) return '/fitting';
    if (rawData.length > 0) return '/preprocess';
    return '/import';
  };

  return (
    <Routes>
      <Route path="/" element={<Navigate to={getDefaultRoute()} replace />} />
      <Route path="/import" element={<DataImportPage />} />
      <Route path="/preprocess" element={<PreprocessPage />} />
      <Route path="/fitting" element={<FittingPage />} />
      <Route path="/report" element={<ReportPage />} />
      <Route path="/history" element={<HistoryPage />} />
      <Route path="/home" element={<Home />} />
      <Route path="*" element={<Navigate to="/import" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <Router>
      <AppRoutes />
    </Router>
  );
}
