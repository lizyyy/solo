import { useEffect, useState } from "react";
import { useStore } from "@/store";
import { cn } from "@/lib/utils";
import TradeTab from "./entry/TradeTab";
import CollateralTab from "./entry/CollateralTab";
import RateTab from "./entry/RateTab";

const tabs = [
  { key: "trades", label: "交易单" },
  { key: "collaterals", label: "质押券" },
  { key: "rates", label: "折算率" },
];

export default function Entry() {
  const { currentBatchId, batches, fetchTrades, fetchCollaterals, fetchRates } = useStore();
  const [activeTab, setActiveTab] = useState("trades");

  const currentBatch = batches.find((b) => b.id === currentBatchId);

  useEffect(() => {
    if (currentBatchId) {
      fetchTrades(currentBatchId);
      fetchCollaterals(currentBatchId);
      fetchRates(currentBatchId);
    }
  }, [currentBatchId, fetchTrades, fetchCollaterals, fetchRates]);

  if (!currentBatchId || !currentBatch) {
    return (
      <div className="py-20 text-center text-brand-text-secondary">
        请先从首页选择一个批次
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-brand-text-primary">数据录入</h1>
          <p className="mt-1 text-sm text-brand-text-secondary">
            当前批次：{currentBatch.name} ({currentBatch.date})
          </p>
        </div>
      </div>

      <div className="mb-4 flex border-b border-slate-700">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors",
              activeTab === tab.key
                ? "border-b-2 border-brand-warning text-brand-warning"
                : "text-brand-text-secondary hover:text-brand-text-primary"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "trades" && <TradeTab />}
      {activeTab === "collaterals" && <CollateralTab />}
      {activeTab === "rates" && <RateTab />}
    </div>
  );
}
