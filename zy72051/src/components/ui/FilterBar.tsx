import { useState } from 'react';
import { X, Filter, ChevronDown, RotateCcw, Download } from 'lucide-react';
import { useFilters, useSandboxStore } from '../../store/useSandboxStore';
import { DISTRICTS, ANOMALY_LABELS, type AnomalyType } from '../../data/types';
import { exportScreenshot, exportDataAsJSON, generateExportMetadata } from '../../utils/export';
import { calculateStatistics } from '../../utils/filter';
import { useFilteredBuildings } from '../../store/useSandboxStore';
import { formatFilterSummary } from '../../utils/storage';

export function FilterBar() {
  const filters = useFilters();
  const setFilters = useSandboxStore(s => s.setFilters);
  const resetAll = useSandboxStore(s => s.resetAll);
  const currentHour = useSandboxStore(s => s.currentHour);
  const filteredBuildings = useFilteredBuildings();
  const [showDistrict, setShowDistrict] = useState(false);
  const [showAnomaly, setShowAnomaly] = useState(false);

  const toggleDistrict = (district: string) => {
    const newDistrict = filters.district.includes(district)
      ? filters.district.filter(d => d !== district)
      : [...filters.district, district];
    setFilters({ district: newDistrict });
  };

  const toggleAnomaly = (anomaly: string) => {
    const newAnomaly = filters.anomalyType.includes(anomaly)
      ? filters.anomalyType.filter(a => a !== anomaly)
      : [...filters.anomalyType, anomaly];
    setFilters({ anomalyType: newAnomaly });
  };

  const clearDistrict = () => setFilters({ district: [] });
  const clearAnomaly = () => setFilters({ anomalyType: [] });
  const resetFilters = () => resetAll();

  const handleExportScreenshot = async () => {
    try {
      await exportScreenshot({
        filters,
        currentHour,
      });
    } catch (e) {
      console.error('Export failed:', e);
    }
  };

  const handleExportData = () => {
    const stats = calculateStatistics(filteredBuildings);
    const metadata = generateExportMetadata(filters, currentHour, stats);
    exportDataAsJSON(
      { metadata, buildings: filteredBuildings },
      `日照数据_${new Date().toISOString().slice(0, 10)}.json`
    );
  };

  const activeFilters = [
    ...filters.district.map(d => ({ type: 'district', value: d, label: d })),
    ...filters.anomalyType.map(a => ({
      type: 'anomaly',
      value: a,
      label: ANOMALY_LABELS[a as AnomalyType],
    })),
  ];

  if (filters.floors[0] > 1 || filters.floors[1] < 100) {
    activeFilters.push({
      type: 'floors',
      value: `${filters.floors[0]}-${filters.floors[1]}`,
      label: `楼层: ${filters.floors[0]}-${filters.floors[1]}`,
    });
  }

  if (filters.sunlightHours[0] > 0 || filters.sunlightHours[1] < 24) {
    activeFilters.push({
      type: 'sunlight',
      value: `${filters.sunlightHours[0]}-${filters.sunlightHours[1]}`,
      label: `日照: ${filters.sunlightHours[0]}-${filters.sunlightHours[1]}h`,
    });
  }

  const removeFilter = (type: string, value: string) => {
    if (type === 'district') {
      toggleDistrict(value);
    } else if (type === 'anomaly') {
      toggleAnomaly(value);
    }
  };

  return (
    <div className="h-16 bg-[#0a1628] border-b border-[#1a2a4a] flex items-center px-4 gap-4 relative">
      <div className="flex items-center gap-2 text-[#ffb347]">
        <Filter size={18} />
        <span className="text-sm font-medium tracking-wide">筛选条件</span>
      </div>

      <div className="relative">
        <button
          className="flex items-center gap-2 px-3 py-1.5 border border-[#2a3a5a] rounded text-sm text-[#c4d4e8] hover:border-[#ffb347] hover:text-white transition-colors"
          onClick={() => { setShowDistrict(!showDistrict); setShowAnomaly(false); }}
        >
          区域
          <ChevronDown size={14} className={showDistrict ? 'rotate-180' : ''} />
        </button>
        {showDistrict && (
          <div className="absolute top-full left-0 mt-1 bg-[#0f1f3a] border border-[#2a3a5a] rounded shadow-lg z-50 min-w-40 max-h-60 overflow-y-auto">
            {DISTRICTS.map(d => (
              <label
                key={d}
                className="flex items-center gap-2 px-3 py-2 hover:bg-[#1a2a4a] cursor-pointer text-sm text-[#c4d4e8]"
              >
                <input
                  type="checkbox"
                  checked={filters.district.includes(d)}
                  onChange={() => toggleDistrict(d)}
                  className="accent-[#ffb347]"
                />
                {d}
              </label>
            ))}
            <div className="border-t border-[#2a3a5a] p-2">
              <button
                onClick={clearDistrict}
                className="w-full text-xs text-[#8a9ab0] hover:text-white py-1"
              >
                清空选择
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="relative">
        <button
          className="flex items-center gap-2 px-3 py-1.5 border border-[#2a3a5a] rounded text-sm text-[#c4d4e8] hover:border-[#ffb347] hover:text-white transition-colors"
          onClick={() => { setShowAnomaly(!showAnomaly); setShowDistrict(false); }}
        >
          异常类型
          <ChevronDown size={14} className={showAnomaly ? 'rotate-180' : ''} />
        </button>
        {showAnomaly && (
          <div className="absolute top-full left-0 mt-1 bg-[#0f1f3a] border border-[#2a3a5a] rounded shadow-lg z-50 min-w-48 max-h-60 overflow-y-auto">
            {Object.entries(ANOMALY_LABELS).map(([key, label]) => (
              <label
                key={key}
                className="flex items-center gap-2 px-3 py-2 hover:bg-[#1a2a4a] cursor-pointer text-sm text-[#c4d4e8]"
              >
                <input
                  type="checkbox"
                  checked={filters.anomalyType.includes(key)}
                  onChange={() => toggleAnomaly(key)}
                  className="accent-[#ffb347]"
                />
                {label}
              </label>
            ))}
            <div className="border-t border-[#2a3a5a] p-2">
              <button
                onClick={clearAnomaly}
                className="w-full text-xs text-[#8a9ab0] hover:text-white py-1"
              >
                清空选择
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 text-sm text-[#8a9ab0]">
        <span>楼层</span>
        <input
          type="number"
          min={1}
          max={filters.floors[1]}
          value={filters.floors[0]}
          onChange={e =>
            setFilters({
              floors: [Math.max(1, parseInt(e.target.value) || 1), filters.floors[1]],
            })
          }
          className="w-16 bg-[#0f1f3a] border border-[#2a3a5a] rounded px-2 py-1 text-sm text-[#c4d4e8] focus:border-[#ffb347] outline-none"
        />
        <span>-</span>
        <input
          type="number"
          min={filters.floors[0]}
          max={100}
          value={filters.floors[1]}
          onChange={e =>
            setFilters({
              floors: [filters.floors[0], Math.min(100, parseInt(e.target.value) || 100)],
            })
          }
          className="w-16 bg-[#0f1f3a] border border-[#2a3a5a] rounded px-2 py-1 text-sm text-[#c4d4e8] focus:border-[#ffb347] outline-none"
        />
      </div>

      <div className="flex items-center gap-2 text-sm text-[#8a9ab0]">
        <span>日照(h)</span>
        <input
          type="number"
          min={0}
          max={filters.sunlightHours[1]}
          step={0.5}
          value={filters.sunlightHours[0]}
          onChange={e =>
            setFilters({
              sunlightHours: [
                Math.max(0, parseFloat(e.target.value) || 0),
                filters.sunlightHours[1],
              ],
            })
          }
          className="w-16 bg-[#0f1f3a] border border-[#2a3a5a] rounded px-2 py-1 text-sm text-[#c4d4e8] focus:border-[#ffb347] outline-none"
        />
        <span>-</span>
        <input
          type="number"
          min={filters.sunlightHours[0]}
          max={24}
          step={0.5}
          value={filters.sunlightHours[1]}
          onChange={e =>
            setFilters({
              sunlightHours: [
                filters.sunlightHours[0],
                Math.min(24, parseFloat(e.target.value) || 24),
              ],
            })
          }
          className="w-16 bg-[#0f1f3a] border border-[#2a3a5a] rounded px-2 py-1 text-sm text-[#c4d4e8] focus:border-[#ffb347] outline-none"
        />
      </div>

      <div className="flex-1 flex flex-wrap items-center gap-2 ml-4 overflow-x-auto">
        {activeFilters.map((f, i) => (
          <span
            key={`${f.type}-${f.value}-${i}`}
            className="inline-flex items-center gap-1 px-2 py-1 bg-[#1a2a4a] border border-[#2a3a5a] rounded text-xs text-[#c4d4e8] whitespace-nowrap"
          >
            {f.label}
            {(f.type === 'district' || f.type === 'anomaly') && (
              <button
                onClick={() => removeFilter(f.type, f.value)}
                className="hover:text-[#ff6b6b] ml-1"
              >
                <X size={12} />
              </button>
            )}
          </span>
        ))}
      </div>

      <div className="flex items-center gap-2 border-l border-[#2a3a5a] pl-4">
        <span className="text-xs text-[#8a9ab0] mr-2">
          {formatFilterSummary(filters)}
        </span>
        <button
          onClick={handleExportScreenshot}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#ffb347] text-[#0a1628] rounded text-sm font-medium hover:bg-[#ffc971] transition-colors"
        >
          <Download size={14} />
          截图导出
        </button>
        <button
          onClick={handleExportData}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-[#2a3a5a] text-[#c4d4e8] rounded text-sm hover:border-[#ffb347] transition-colors"
        >
          导出数据
        </button>
        <button
          onClick={resetFilters}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-[#2a3a5a] text-[#8a9ab0] rounded text-sm hover:border-[#ff6b6b] hover:text-[#ff6b6b] transition-colors"
          title="重置所有"
        >
          <RotateCcw size={14} />
        </button>
      </div>
    </div>
  );
}
