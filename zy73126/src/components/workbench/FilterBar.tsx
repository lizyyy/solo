import { useMemo } from "react";
import { MapPin, AlertTriangle, ClipboardCheck, Search } from "lucide-react";
import { useAppStore } from "../../store/useAppStore";
import {
  ANOMALY_LABEL,
  STATUS_LABEL,
  type AnomalyType,
  type RecordStatus,
} from "../../data/types";

export default function FilterBar() {
  const records = useAppStore((s) => s.records);
  const activeFilters = useAppStore((s) => s.activeFilters);
  const setFilters = useAppStore((s) => s.setFilters);

  const stations = useMemo(
    () => [...new Set(records.map((r) => r.station))],
    [records]
  );

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-1.5">
        <MapPin size={14} className="text-deep-200" />
        <select
          value={activeFilters.station ?? ""}
          onChange={(e) =>
            setFilters({ station: e.target.value || undefined })
          }
          className="text-sm px-2 py-1 rounded-lg border border-deep-100 bg-white text-deep-400 focus:outline-none focus:border-coral-400"
        >
          <option value="">全部站点</option>
          {stations.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-1.5">
        <AlertTriangle size={14} className="text-deep-200" />
        <select
          value={activeFilters.anomalyType ?? ""}
          onChange={(e) =>
            setFilters({
              anomalyType: (e.target.value as AnomalyType) || undefined,
            })
          }
          className="text-sm px-2 py-1 rounded-lg border border-deep-100 bg-white text-deep-400 focus:outline-none focus:border-coral-400"
        >
          <option value="">全部异常</option>
          {(Object.entries(ANOMALY_LABEL) as [AnomalyType, string][]).map(
            ([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            )
          )}
        </select>
      </div>

      <div className="flex items-center gap-1.5">
        <ClipboardCheck size={14} className="text-deep-200" />
        <select
          value={activeFilters.status ?? ""}
          onChange={(e) =>
            setFilters({
              status: (e.target.value as RecordStatus) || undefined,
            })
          }
          className="text-sm px-2 py-1 rounded-lg border border-deep-100 bg-white text-deep-400 focus:outline-none focus:border-coral-400"
        >
          <option value="">全部状态</option>
          {(Object.entries(STATUS_LABEL) as [RecordStatus, string][]).map(
            ([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            )
          )}
        </select>
      </div>

      <div className="flex items-center gap-1.5">
        <Search size={14} className="text-deep-200" />
        <input
          type="text"
          placeholder="关键词搜索"
          value={activeFilters.keyword ?? ""}
          onChange={(e) =>
            setFilters({ keyword: e.target.value || undefined })
          }
          className="text-sm px-2 py-1 rounded-lg border border-deep-100 bg-white text-deep-400 placeholder:text-deep-200 focus:outline-none focus:border-coral-400 w-40"
        />
      </div>
    </div>
  );
}
