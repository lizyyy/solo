import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useEffect } from 'react';
import { ReviewList } from "@/pages/ReviewList";
import { ReviewDetail } from "@/pages/ReviewDetail";
import { useReviewStore } from "@/store/useReviewStore";
import { initMockData } from "@/utils/mockData";

export default function App() {
  const loadReviews = useReviewStore(s => s.loadReviews);

  useEffect(() => {
    initMockData();
    loadReviews();
  }, [loadReviews]);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<ReviewList />} />
        <Route path="/review/:id" element={<ReviewDetail />} />
      </Routes>
    </Router>
  );
}
