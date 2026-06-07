import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { WorkflowPage } from "./pages/Workflow";
import { PlaybackListPage } from "./pages/PlaybackList";
import { PlaybackDetailPage } from "./pages/PlaybackDetail";
import { AnomaliesPage } from "./pages/Anomalies";
import { VisualizationPage } from "./pages/Visualization";
import { RulesPage } from "./pages/Rules";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<WorkflowPage />} />
          <Route path="/playbacks" element={<PlaybackListPage />} />
          <Route path="/playbacks/:id" element={<PlaybackDetailPage />} />
          <Route path="/anomalies" element={<AnomaliesPage />} />
          <Route path="/visualization" element={<VisualizationPage />} />
          <Route path="/rules" element={<RulesPage />} />
        </Route>
      </Routes>
    </Router>
  );
}
