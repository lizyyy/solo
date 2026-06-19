import { BrowserRouter, Routes, Route } from "react-router-dom";
import FittingPage from "@/pages/FittingPage";
import ReviewPage from "@/pages/ReviewPage";
import SummaryPage from "@/pages/SummaryPage";
import { useFittingStore } from "@/stores/fittingStore";
import { useEffect } from "react";

function App() {
  const initSummary = useFittingStore((s) => s.rebuildSummary);
  useEffect(() => {
    initSummary();
  }, [initSummary]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<FittingPage />} />
        <Route path="/review" element={<ReviewPage />} />
        <Route path="/summary" element={<SummaryPage />} />
        <Route path="*" element={<FittingPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
