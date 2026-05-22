import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import BatchList from "@/pages/BatchList";
import CreateBatch from "@/pages/CreateBatch";
import BatchDetail from "@/pages/BatchDetail";
import ReviewWorkbench from "@/pages/ReviewWorkbench";
import Settlement from "@/pages/Settlement";
import Reports from "@/pages/Reports";
import AuditLog from "@/pages/AuditLog";
import { useAuthStore } from "@/store/authStore";

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="batches" element={<BatchList />} />
          <Route path="batches/create" element={<CreateBatch />} />
          <Route path="batches/:id" element={<BatchDetail />} />
          <Route path="review" element={<ReviewWorkbench />} />
          <Route path="settlement" element={<Settlement />} />
          <Route path="reports" element={<Reports />} />
          <Route path="audit" element={<AuditLog />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  );
}
