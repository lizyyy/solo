import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import RecordsList from "@/pages/RecordsList";
import RecordDetail from "@/pages/RecordDetail";
import InsuranceList from "@/pages/InsuranceList";
import ExhibitionList from "@/pages/ExhibitionList";
import OperationsCenter from "@/pages/OperationsCenter";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<RecordsList />} />
          <Route path="/record/:id" element={<RecordDetail />} />
          <Route path="/insurance" element={<InsuranceList />} />
          <Route path="/exhibition" element={<ExhibitionList />} />
          <Route path="/operations" element={<OperationsCenter />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
