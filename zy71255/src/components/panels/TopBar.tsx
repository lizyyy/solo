import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  Camera,
  GitCompare,
  Download,
  AlertTriangle,
  ChevronDown,
  Globe,
  Eye,
  Maximize2,
  Focus,
} from 'lucide-react';
import type { Enterprise, Period, Snapshot } from '@/types';
import { useDataStore } from '@/store/useDataStore';
import { useFilterStore } from '@/store/useFilterStore';
import { useUIStore, ViewPreset } from '@/store/useUIStore';
import { useSelectionStore } from '@/store/useSelectionStore';
import GlassPanel from '@/components/ui/GlassPanel';
import Button from '@/components/ui/Button';
import Slider from '@/components/ui/Slider';
import Badge from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

const viewPresets: { id: ViewPreset; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: '全景', icon: <Globe className="w-4 h-4" /> },
  { id: 'top', label: '俯视图', icon: <Eye className="w-4 h-4" /> },
  { id: 'side', label: '侧视图', icon: <Maximize2 className="w-4 h-4" /> },
  { id: 'focus', label: '聚焦选中', icon: <Focus className="w-4 h-4" /> },
];

interface TopBarProps {
  enterprises: Enterprise[];
  periods: Period[];
  snapshots: Snapshot[];
  onCreateSnapshot: (description: string) => Snapshot | Promise<Snapshot>;
  onExport: (type: 'pdf' | 'excel' | 'json' | 'screenshot') => void;
}

export default function TopBar({
  enterprises,
  periods,
  snapshots,
  onCreateSnapshot,
  onExport,
}: TopBarProps) {
  const {
    timePosition,
    isPlaying,
    selectedPeriod,
    setTimePosition,
    togglePlaying,
    setSelectedPeriod,
  } = useFilterStore();

  const {
    currentViewPreset,
    setViewPreset,
    setShowVersionCompareModal,
    setShowIssueList,
  } = useUIStore();

  const { selectedEnterpriseId } = useSelectionStore();
  const { issues, createSnapshot } = useDataStore();

  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [showSnapshotInput, setShowSnapshotInput] = useState(false);
  const [snapshotDescription, setSnapshotDescription] = useState('');

  const animationRef = useRef<number | null>(null);

  const currentPeriod = periods.find((p) => p.id === selectedPeriod);
  const activePeriods = periods.filter((p) => p.status === 'upcoming' || p.status === 'active' || p.status === 'completed');
  const openIssues = issues.filter((i) => i.status === 'open' || (i.status as string) === 'investigating');

  const getCurrentDate = () => {
    if (!currentPeriod) return new Date().toLocaleDateString('zh-CN');
    const start = new Date(currentPeriod.startDate);
    const end = new Date(currentPeriod.endDate);
    const time = start.getTime() + (end.getTime() - start.getTime()) * (timePosition / 100);
    return new Date(time).toLocaleDateString('zh-CN');
  };

  useEffect(() => {
    if (isPlaying) {
      const animate = () => {
        setTimePosition((prev: number) => {
          const next = prev + 0.5;
          if (next >= 100) return 0;
          return next;
        });
        animationRef.current = requestAnimationFrame(animate);
      };
      animationRef.current = requestAnimationFrame(animate);
    } else if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, setTimePosition]);

  const handleCreateSnapshot = () => {
    if (snapshotDescription.trim()) {
      createSnapshot(snapshotDescription);
      setSnapshotDescription('');
      setShowSnapshotInput(false);
    }
  };

  const handleViewPresetChange = (preset: ViewPreset) => {
    if (preset === 'focus' && selectedEnterpriseId) {
      const enterprise = enterprises.find((e) => e.id === selectedEnterpriseId);
      if (enterprise) {
        const pos = enterprise.position as unknown as { x: number; y: number; z: number };
        useUIStore.getState().setCameraPosition([pos.x, pos.y + 5, pos.z + 10]);
        useUIStore.getState().setCameraTarget([pos.x, pos.y, pos.z]);
      }
    }
    setViewPreset(preset);
  };

  return (
    <GlassPanel
      padding="px-6 py-3"
      rounded="rounded-2xl"
      className="w-full"
    >
      <div className="flex items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <motion.div
            className="flex items-center gap-2"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #00FF9D 0%, #00D4FF 100%)',
                boxShadow: '0 0 20px rgba(0, 255, 157, 0.4)',
              }}
            >
              <Globe className="w-6 h-6 text-primary-400" />
            </div>
            <h1
              className="text-xl font-bold tracking-wider text-white"
              style={{ fontFamily: "'Orbitron', sans-serif" }}
            >
              碳交易流向河图
            </h1>
          </motion.div>
        </div>

        <div className="flex-1 flex items-center justify-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={togglePlaying}
            icon={isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          >
            {isPlaying ? '暂停' : '播放'}
          </Button>

          <div className="flex-1 max-w-md flex items-center gap-3">
            <Slider
              value={timePosition}
              onChange={(val) => setTimePosition(val as number)}
              showLabel={false}
              className="flex-1"
            />
            <span className="text-accent-cyan text-sm font-medium min-w-[100px] text-right">
              {getCurrentDate()}
            </span>
          </div>

          <div className="relative">
            <Button
              variant="secondary"
              size="sm"
              icon={<ChevronDown className="w-4 h-4" />}
              iconPosition="right"
              onClick={() => setShowPeriodDropdown(!showPeriodDropdown)}
            >
              {currentPeriod?.name || '选择履约期'}
            </Button>
            <AnimatePresence>
              {showPeriodDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute top-full left-0 mt-2 w-48 z-50"
                  style={{
                    backgroundColor: 'rgba(10, 22, 40, 0.95)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
                  }}
                >
                  <div className="py-2">
                    {activePeriods.map((period) => (
                      <button
                        key={period.id}
                        onClick={() => {
                          setSelectedPeriod(period.id);
                          setShowPeriodDropdown(false);
                        }}
                        className={cn(
                          'w-full px-4 py-2 text-left text-sm transition-colors',
                          selectedPeriod === period.id
                            ? 'bg-accent-cyan/20 text-accent-cyan'
                            : 'text-white/70 hover:bg-white/5'
                        )}
                      >
                        <div className="font-medium">{period.name}</div>
                        <div className="text-xs text-white/50">
                          {period.startDate} ~ {period.endDate}
                        </div>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-2">
            {viewPresets.map((preset) => (
              <Button
                key={preset.id}
                variant={currentViewPreset === preset.id ? 'primary' : 'ghost'}
                size="sm"
                icon={preset.icon}
                onClick={() => handleViewPresetChange(preset.id)}
                className="px-3"
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {showSnapshotInput ? (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={snapshotDescription}
                onChange={(e) => setSnapshotDescription(e.target.value)}
                placeholder="输入快照描述..."
                className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-accent-cyan/50"
                style={{ width: '200px' }}
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleCreateSnapshot()}
              />
              <Button variant="primary" size="sm" onClick={handleCreateSnapshot}>
                确认
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowSnapshotInput(false);
                  setSnapshotDescription('');
                }}
              >
                取消
              </Button>
            </motion.div>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              icon={<Camera className="w-4 h-4" />}
              onClick={() => setShowSnapshotInput(true)}
            >
              创建快照
            </Button>
          )}

          <Button
            variant="secondary"
            size="sm"
            icon={<GitCompare className="w-4 h-4" />}
            onClick={() => setShowVersionCompareModal(true)}
          >
            版本对比
          </Button>

          <div className="relative">
            <Button
              variant="secondary"
              size="sm"
              icon={<Download className="w-4 h-4" />}
              iconPosition="left"
              onClick={() => setShowExportDropdown(!showExportDropdown)}
            >
              导出
              <ChevronDown className="w-3 h-3 ml-1" />
            </Button>
            <AnimatePresence>
              {showExportDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute top-full right-0 mt-2 w-40 z-50"
                  style={{
                    backgroundColor: 'rgba(10, 22, 40, 0.95)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
                  }}
                >
                  <div className="py-2">
                    {[
                      { id: 'pdf', label: '导出 PDF' },
                      { id: 'excel', label: '导出 Excel' },
                      { id: 'json', label: '导出 JSON' },
                      { id: 'screenshot', label: '导出截图' },
                    ].map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          onExport(item.id as 'pdf' | 'excel' | 'json' | 'screenshot');
                          setShowExportDropdown(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-white/70 hover:bg-white/5 hover:text-white transition-colors"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <Button
            variant={openIssues.length > 0 ? 'secondary' : 'danger'}
            size="sm"
            icon={
              <Badge variant="danger" size="sm" pulse={openIssues.length > 0}>
                <AlertTriangle className="w-3 h-3" />
                {openIssues.length}
              </Badge>
            }
            onClick={() => setShowIssueList(true)}
          >
            问题
          </Button>
        </div>
      </div>
    </GlassPanel>
  );
}
