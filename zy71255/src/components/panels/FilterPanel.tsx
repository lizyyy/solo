import { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  Square,
  X,
  Building2,
  Filter,
  GripVertical,
} from 'lucide-react';
import type { Enterprise, Gap, Transaction } from '@/types';
import { useFilterStore } from '@/store/useFilterStore';
import { useSelectionStore } from '@/store/useSelectionStore';
import { useUIStore } from '@/store/useUIStore';
import GlassPanel from '@/components/ui/GlassPanel';
import Button from '@/components/ui/Button';
import Slider from '@/components/ui/Slider';
import Switch from '@/components/ui/Switch';
import { cn } from '@/lib/utils';

interface FilterPanelProps {
  enterprises: Enterprise[];
  gaps: Gap[];
  transactions: Transaction[];
  selectedPeriod: string | null;
}

export default function FilterPanel({
  enterprises,
  gaps,
  transactions,
  selectedPeriod,
}: FilterPanelProps) {
  const {
    selectedEnterprises,
    showOnlyWithGap,
    gapThreshold,
    showIssues,
    showFlows,
    searchQuery,
    toggleEnterprise,
    selectAllEnterprises,
    clearEnterprises,
    setShowOnlyWithGap,
    setGapThreshold,
    setShowIssues,
    setShowFlows,
    setSearchQuery,
  } = useFilterStore();

  const { selectEnterprise } = useSelectionStore();

  const {
    leftPanelCollapsed,
    leftPanelWidth,
    toggleLeftPanel,
    setLeftPanelWidth,
    setIsResizingLeft,
  } = useUIStore();

  const [expandedIndustries, setExpandedIndustries] = useState<Set<string>>(new Set());
  const resizeRef = useRef<HTMLDivElement>(null);
  const isResizingRef = useRef(false);

  const industryColors: Record<string, string> = useMemo(() => {
    const colors: Record<string, string> = {};
    enterprises.forEach((e) => {
      if (!colors[e.industry]) {
        colors[e.industry] = e.color;
      }
    });
    return colors;
  }, [enterprises]);

  const enterprisesByIndustry = useMemo(() => {
    const grouped: Record<string, Enterprise[]> = {};
    enterprises.forEach((enterprise) => {
      const matchesSearch = enterprise.name
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      
      const enterpriseGap = gaps.find(
        (g) => g.enterpriseId === enterprise.id && g.periodId === selectedPeriod
      );
      const hasGap = enterpriseGap && enterpriseGap.gap > 0;
      const meetsGapThreshold = !enterpriseGap || enterpriseGap.gap >= gapThreshold;
      
      const passesFilters =
        matchesSearch &&
        (!showOnlyWithGap || hasGap) &&
        (!showOnlyWithGap || gapThreshold === 0 || meetsGapThreshold);

      if (passesFilters) {
        if (!grouped[enterprise.industry]) {
          grouped[enterprise.industry] = [];
        }
        grouped[enterprise.industry].push(enterprise);
      }
    });
    return grouped;
  }, [enterprises, gaps, selectedPeriod, searchQuery, showOnlyWithGap, gapThreshold]);

  const toggleIndustry = (industry: string) => {
    setExpandedIndustries((prev) => {
      const next = new Set(prev);
      if (next.has(industry)) {
        next.delete(industry);
      } else {
        next.add(industry);
      }
      return next;
    });
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    setIsResizingLeft(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      const newWidth = e.clientX;
      setLeftPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      isResizingRef.current = false;
      setIsResizingLeft(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    if (isResizingRef.current) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [setLeftPanelWidth, setIsResizingLeft]);

  const isEnterpriseSelected = (id: string) => selectedEnterprises.includes(id);

  const handleEnterpriseClick = (id: string) => {
    toggleEnterprise(id);
    selectEnterprise(id, transactions);
  };

  const getEnterpriseGap = (enterpriseId: string) => {
    const gap = gaps.find(
      (g) => g.enterpriseId === enterpriseId && g.periodId === selectedPeriod
    );
    return gap?.gap || 0;
  };

  if (leftPanelCollapsed) {
    return (
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="h-full flex items-center"
      >
        <Button
          variant="secondary"
          size="sm"
          icon={<ChevronRight className="w-4 h-4" />}
          onClick={toggleLeftPanel}
          className="h-20 rounded-l-none rounded-r-2xl"
        />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="h-full flex"
      style={{ width: leftPanelWidth }}
    >
      <GlassPanel
        padding="p-4"
        rounded="rounded-2xl rounded-l-none"
        className="h-full flex flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-accent-cyan" />
            <h2
              className="text-lg font-semibold text-white"
              style={{ fontFamily: "'Orbitron', sans-serif" }}
            >
              筛选面板
            </h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            icon={<ChevronLeft className="w-4 h-4" />}
            onClick={toggleLeftPanel}
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-6 pr-1">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-white/80 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-accent-green" />
              企业筛选
            </h3>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索企业..."
                className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-white/30 focus:outline-none focus:border-accent-cyan/50 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                icon={<CheckSquare className="w-4 h-4" />}
                onClick={() => selectAllEnterprises(enterprises)}
                className="flex-1"
              >
                全选
              </Button>
              <Button
                variant="ghost"
                size="sm"
                icon={<Square className="w-4 h-4" />}
                onClick={clearEnterprises}
                className="flex-1"
              >
                清空
              </Button>
            </div>

            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {Object.entries(enterprisesByIndustry).map(([industry, ents]) => (
                <div key={industry} className="space-y-1">
                  <button
                    onClick={() => toggleIndustry(industry)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: industryColors[industry] }}
                      />
                      <span className="text-sm font-medium text-white/80">
                        {industry}
                      </span>
                      <span className="text-xs text-white/40">
                        ({ents.length})
                      </span>
                    </div>
                    <motion.div
                      animate={{
                        rotate: expandedIndustries.has(industry) ? 90 : 0,
                      }}
                      className="text-white/40"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </motion.div>
                  </button>

                  <AnimatePresence>
                    {expandedIndustries.has(industry) && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="pl-4 space-y-1">
                          {ents.map((enterprise) => {
                            const isSelected = isEnterpriseSelected(enterprise.id);
                            const gap = getEnterpriseGap(enterprise.id);
                            const hasGap = gap > 0;

                            return (
                              <motion.button
                                key={enterprise.id}
                                whileHover={{ x: 4 }}
                                onClick={() => handleEnterpriseClick(enterprise.id)}
                                className={cn(
                                  'w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors text-left',
                                  isSelected
                                    ? 'bg-accent-cyan/20'
                                    : 'hover:bg-white/5'
                                )}
                              >
                                <div className="flex items-center gap-2">
                                  {isSelected ? (
                                    <CheckSquare className="w-4 h-4 text-accent-cyan" />
                                  ) : (
                                    <Square className="w-4 h-4 text-white/30" />
                                  )}
                                  <span
                                    className={cn(
                                      'text-sm',
                                      isSelected
                                        ? 'text-accent-cyan'
                                        : 'text-white/70'
                                    )}
                                  >
                                    {enterprise.name}
                                  </span>
                                </div>
                                {hasGap && (
                                  <span className="text-xs text-accent-red font-medium">
                                    -{gap}吨
                                  </span>
                                )}
                              </motion.button>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}

              {Object.keys(enterprisesByIndustry).length === 0 && (
                <div className="text-center py-8 text-white/40 text-sm">
                  没有找到匹配的企业
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-white/80 flex items-center gap-2">
              <Filter className="w-4 h-4 text-accent-purple" />
              数据筛选
            </h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/70">只显示有缺口企业</span>
                <Switch
                  checked={showOnlyWithGap}
                  onChange={setShowOnlyWithGap}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/70">缺口阈值</span>
                  <span className="text-sm text-accent-cyan font-medium">
                    {gapThreshold} 吨
                  </span>
                </div>
                <Slider
                  min={0}
                  max={500}
                  step={10}
                  value={gapThreshold}
                  onChange={(val) => setGapThreshold(val as number)}
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-white/70">显示问题标记</span>
                <Switch
                  checked={showIssues}
                  onChange={setShowIssues}
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-white/70">显示交易流线</span>
                <Switch
                  checked={showFlows}
                  onChange={setShowFlows}
                />
              </div>
            </div>
          </div>
        </div>
      </GlassPanel>

      <div
        ref={resizeRef}
        onMouseDown={handleResizeStart}
        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-accent-cyan/50 transition-colors z-20"
        style={{ right: '-2px' }}
      >
        <div className="absolute top-1/2 -translate-y-1/2 -left-1">
          <GripVertical className="w-3 h-3 text-white/20" />
        </div>
      </div>
    </motion.div>
  );
}
