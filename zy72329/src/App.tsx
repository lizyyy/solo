import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import { useAuthStore } from "./store/authStore";
import Layout from "./components/Layout";
import LoginPage from "./components/LoginPage";
import ResultPage from "./pages/ResultPage";
import ImportPage from "./pages/ImportPage";
import ConflictPage from "./pages/ConflictPage";
import GapReviewPage from "./pages/GapReviewPage";
import VersionPage from "./pages/VersionPage";
import HistoryPage from "./pages/HistoryPage";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  const { initialize, isAuthenticated } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<ResultPage />} />
          <Route path="result" element={<ResultPage />} />
          <Route path="import" element={<ImportPage />} />
          <Route path="conflicts" element={<ConflictPage />} />
          <Route path="conflict" element={<Navigate to="/conflicts" replace />} />
          <Route path="gaps" element={<GapReviewPage />} />
          <Route path="gap-review" element={<Navigate to="/gaps" replace />} />
          <Route path="versions" element={<VersionPage />} />
          <Route path="history" element={<HistoryPage />} />
        </Route>
        <Route path="*" element={<Navigate to={isAuthenticated ? "/" : "/login"} replace />} />
      </Routes>
    </Router>
  );
}
