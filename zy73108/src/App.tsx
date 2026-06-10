import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppHeader } from "@/components/AppHeader";
import { HandoverModal } from "@/components/HandoverModal";
import { Home } from "@/pages/Home";
import { Timeline } from "@/pages/Timeline";
import { useMaterialStore } from "@/store/materialStore";
import { buildSampleData } from "@/utils/sampleData";
import type { FilterOptions } from "@/types";
import { RefreshCw } from "lucide-react";

const SEED_KEY = "rzts_seeded_v1";

const App = () => {
  const [operator, setOperator] = useState<string>(
    () => localStorage.getItem("rzts_operator") || "小赵"
  );
  const [handoverOpen, setHandoverOpen] = useState(false);
  const [handoverFilter, setHandoverFilter] = useState<FilterOptions>({});

  const hydrate = useMaterialStore((s) => s.hydrate);
  const persist = useMaterialStore((s) => s.persist);
  const records = useMaterialStore((s) => s.records);
  const logs = useMaterialStore((s) => s.logs);
  const hydrated = useMaterialStore((s) => s.hydrated);
  const reset = useMaterialStore((s) => s.reset);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated) return;
    if (records.length === 0 && !localStorage.getItem(SEED_KEY)) {
      const sample = buildSampleData();
      useMaterialStore.setState({
        records: sample.records,
        logs: sample.logs,
      });
      localStorage.setItem(SEED_KEY, "1");
      persist();
    }
  }, [hydrated, records.length, persist]);

  useEffect(() => {
    localStorage.setItem("rzts_operator", operator);
  }, [operator]);

  const openHandover = () => {
    const filter: FilterOptions = {};
    setHandoverFilter(filter);
    setHandoverOpen(true);
  };

  const resetAll = () => {
    if (confirm("确认清空所有数据并恢复演示数据？此操作不可撤销。")) {
      reset();
      localStorage.removeItem(SEED_KEY);
      setTimeout(() => {
        const sample = buildSampleData();
        useMaterialStore.setState({
          records: sample.records,
          logs: sample.logs,
        });
        localStorage.setItem(SEED_KEY, "1");
        persist();
      }, 100);
    }
  };

  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col">
        <AppHeader
          operator={operator}
          onOperatorChange={setOperator}
          onOpenHandover={openHandover}
        />
        <main className="flex-1 pb-12">
          <Routes>
            <Route path="/" element={<Home operator={operator} />} />
            <Route path="/timeline" element={<Timeline />} />
          </Routes>
        </main>
        <footer className="border-t border-paper-line bg-white/70 backdrop-blur">
          <div className="container max-w-[1400px] px-6 py-3 flex items-center justify-between text-xs text-ink-500">
            <p>
              日照体量方案比选 · 材料送审表 · 变更记录 · 历史时间线 — 统一本地数据源
            </p>
            <div className="flex items-center gap-3">
              <span className="font-mono text-[11px] text-ink-400">
                records: {records.length} · logs: {logs.length}
              </span>
              <button
                onClick={resetAll}
                className="inline-flex items-center gap-1 hover:text-ember-500 transition-colors"
                title="重置为演示数据"
              >
                <RefreshCw size={11} /> 重置
              </button>
            </div>
          </div>
        </footer>
      </div>
      <HandoverModal
        open={handoverOpen}
        onClose={() => setHandoverOpen(false)}
        filter={handoverFilter}
      />
    </BrowserRouter>
  );
};

export default App;
