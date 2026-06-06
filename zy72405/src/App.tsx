import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { RecordList } from "@/pages/RecordList";
import { ImportPage } from "@/pages/ImportPage";
import { AliasPage } from "@/pages/AliasPage";
import { RecordDetail } from "@/pages/RecordDetail";
import { RulesPage } from "@/pages/RulesPage";

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<RecordList />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/aliases" element={<AliasPage />} />
          <Route path="/record/:id" element={<RecordDetail />} />
          <Route path="/rules" element={<RulesPage />} />
        </Routes>
      </Layout>
    </Router>
  );
}
