import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Header from "@/components/layout/Header";
import StatsBar from "@/components/layout/StatsBar";
import ImportZone from "@/components/workbench/ImportZone";
import FilterBar from "@/components/workbench/FilterBar";
import DataTable from "@/components/workbench/DataTable";
import DetailDrawer from "@/components/detail/DetailDrawer";
import TimelineView from "@/components/timeline/TimelineView";
import ReviewBoard from "@/components/review/ReviewBoard";
import SampleRunner from "@/components/sample/SampleRunner";
import { useAppStore } from "@/store/useAppStore";

function Workbench() {
  return (
    <div className="space-y-4 animate-fade-up">
      <ImportZone />
      <FilterBar />
      <DataTable />
    </div>
  );
}

function MainLayout() {
  const view = useAppStore((s) => s.view);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-6 py-5 space-y-5 pb-24">
        <StatsBar />
        {view === "workbench" && <Workbench />}
        {view === "timeline" && <TimelineView />}
        {view === "review" && <ReviewBoard />}
      </main>
      <DetailDrawer />
      <SampleRunner />
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MainLayout />} />
        <Route path="/timeline" element={<MainLayout />} />
        <Route path="/review" element={<MainLayout />} />
      </Routes>
    </Router>
  );
}
