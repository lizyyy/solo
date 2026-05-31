import { useEffect } from "react";
import { useSettlementStore } from "@/store/settlementStore";
import FilterBar from "@/components/FilterBar";
import SettlementTable from "@/components/SettlementTable";
import BatchActionBar from "@/components/BatchActionBar";

export default function Settlements() {
  const { fetchRecords } = useSettlementStore();

  useEffect(() => {
    fetchRecords();
  }, []);

  return (
    <div className="flex flex-col gap-4 pb-16">
      <FilterBar />
      <SettlementTable />
      <BatchActionBar />
    </div>
  );
}
