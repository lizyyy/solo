import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { ImportPage } from "@/pages/ImportPage";
import { ReviewPage } from "@/pages/ReviewPage";
import { CorrectionPage } from "@/pages/CorrectionPage";
import { HistoryPage } from "@/pages/HistoryPage";
import { ExportPage } from "@/pages/ExportPage";
import { VisualizationPage } from "@/pages/VisualizationPage";
import { UserSetup } from "@/pages/UserSetup";
import { AssistantGuide } from "@/pages/AssistantGuide";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/user-setup" element={<UserSetup />} />
        <Route path="/guide" element={<AssistantGuide />} />
        <Route
          path="/"
          element={
            <Layout>
              <Navigate to="/import" replace />
            </Layout>
          }
        />
        <Route
          path="/import"
          element={
            <Layout>
              <ImportPage />
            </Layout>
          }
        />
        <Route
          path="/review"
          element={
            <Layout>
              <ReviewPage />
            </Layout>
          }
        />
        <Route
          path="/correction"
          element={
            <Layout>
              <CorrectionPage />
            </Layout>
          }
        />
        <Route
          path="/history"
          element={
            <Layout>
              <HistoryPage />
            </Layout>
          }
        />
        <Route
          path="/export"
          element={
            <Layout>
              <ExportPage />
            </Layout>
          }
        />
        <Route
          path="/visualization"
          element={
            <Layout>
              <VisualizationPage />
            </Layout>
          }
        />
      </Routes>
    </Router>
  );
}
