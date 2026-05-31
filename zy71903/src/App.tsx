import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Layout } from "./components/layout/Layout";
import Home from "./pages/Home";
import { RecordDetail } from "./pages/RecordDetail";
import { RecordForm } from "./pages/RecordForm";
import { MismatchHandler } from "./pages/MismatchHandler";
import { RehearsalSummary } from "./pages/RehearsalSummary";
import { ToastProvider, ToastContainer } from "./components/ui/Toast";

export default function App() {
  return (
    <ToastProvider>
      <Router>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/records/new" element={<RecordForm />} />
            <Route path="/records/:id" element={<RecordDetail />} />
            <Route path="/mismatch" element={<MismatchHandler />} />
            <Route path="/summary" element={<RehearsalSummary />} />
          </Route>
        </Routes>
        <ToastContainer />
      </Router>
    </ToastProvider>
  );
}
