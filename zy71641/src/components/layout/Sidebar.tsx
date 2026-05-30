import { Settings, AlertTriangle, Bookmark, GitCompare, FileText, PlusCircle, History, Layers } from 'lucide-react';
import { useSwingStore } from '@/store/useSwingStore';
import { PanelType } from '@/types';

const NAV_ITEMS: { id: PanelType | 'supplement' | 'history'; label: string; icon: React.ReactNode; color: string }[] = [
  { id: 'params', label: '参数面板', icon: <Settings className="w-5 h-5" />, color: 'golf-blue' },
  { id: 'anomalies', label: '异常检测', icon: <AlertTriangle className="w-5 h-5" />, color: 'golf-orange' },
  { id: 'keyframes', label: '关键帧', icon: <Bookmark className="w-5 h-5" />, color: 'golf-green' },
  { id: 'compare', label: '参数对比', icon: <GitCompare className="w-5 h-5" />, color: 'golf-purple' },
  { id: 'supplement', label: '数据补录', icon: <PlusCircle className="w-5 h-5" />, color: 'golf-orange' },
  { id: 'history', label: '版本历史', icon: <History className="w-5 h-5" />, color: 'golf-blue' },
  { id: 'report', label: '训练报告', icon: <FileText className="w-5 h-5" />, color: 'golf-yellow' },
];

export function Sidebar() {
  const { 
    activePanel, 
    setActivePanel,
    currentSession,
    showTrajectory,
    showClubHead,
    showImpactPoint,
    showGrid,
    setShowTrajectory,
    setShowClubHead,
    setShowImpactPoint,
    setShowGrid,
  } = useSwingStore();
  
  const getColorClass = (color: string, isActive: boolean) => {
    const colorMap: Record<string, { active: string; inactive: string; hover: string }> = {
      'golf-blue': {
        active: 'bg-golf-blue/20 text-golf-blue border-golf-blue/50',
        inactive: 'text-golf-text-muted border-transparent',
        hover: 'hover:bg-golf-blue/10 hover:text-golf-blue',
      },
      'golf-orange': {
        active: 'bg-golf-orange/20 text-golf-orange border-golf-orange/50',
        inactive: 'text-golf-text-muted border-transparent',
        hover: 'hover:bg-golf-orange/10 hover:text-golf-orange',
      },
      'golf-green': {
        active: 'bg-golf-green/20 text-golf-green border-golf-green/50',
        inactive: 'text-golf-text-muted border-transparent',
        hover: 'hover:bg-golf-green/10 hover:text-golf-green',
      },
      'golf-purple': {
        active: 'bg-golf-purple/20 text-golf-purple border-golf-purple/50',
        inactive: 'text-golf-text-muted border-transparent',
        hover: 'hover:bg-golf-purple/10 hover:text-golf-purple',
      },
      'golf-yellow': {
        active: 'bg-golf-yellow/20 text-golf-yellow border-golf-yellow/50',
        inactive: 'text-golf-text-muted border-transparent',
        hover: 'hover:bg-golf-yellow/10 hover:text-golf-yellow',
      },
    };
    return colorMap[color]?.[isActive ? 'active' : 'inactive'] || colorMap['golf-blue'].inactive;
  };
  
  const handleNavClick = (id: PanelType | 'supplement' | 'history') => {
    if (id === 'supplement' || id === 'history') {
      setActivePanel(id as PanelType);
    } else {
      setActivePanel(id);
    }
  };
  
  const unconfirmedAnomalies = currentSession?.anomalies.filter(a => !a.isConfirmed && !a.isFalsePositive).length || 0;
  
  return (
    <div className="w-16 bg-golf-bg-light border-r border-golf-border flex flex-col items-center py-4 gap-1">
      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-golf-green to-golf-blue flex items-center justify-center mb-4">
        <span className="text-white font-bold text-lg">G</span>
      </div>
      
      <div className="flex-1 flex flex-col items-center gap-1 w-full px-2">
        {NAV_ITEMS.map(item => {
          const isActive = activePanel === item.id;
          const colorClass = getColorClass(item.color, isActive);
          
          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`relative w-12 h-12 rounded-lg flex items-center justify-center transition-all border ${colorClass} ${
                !isActive ? 'hover:bg-golf-bg-lighter' : ''
              }`}
              title={item.label}
            >
              {item.icon}
              {item.id === 'anomalies' && unconfirmedAnomalies > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-golf-red text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                  {unconfirmedAnomalies}
                </span>
              )}
            </button>
          );
        })}
      </div>
      
      <div className="w-full px-2 pt-4 border-t border-golf-border mt-2">
        <div className="text-[10px] text-golf-text-muted text-center mb-2">显示选项</div>
        <div className="flex flex-col gap-1">
          <button
            onClick={() => setShowTrajectory(!showTrajectory)}
            className={`w-12 h-10 rounded-lg flex items-center justify-center transition-all ${
              showTrajectory 
                ? 'bg-golf-green/20 text-golf-green' 
                : 'text-golf-text-muted hover:bg-golf-bg-lighter hover:text-golf-text'
            }`}
            title="挥杆轨迹"
          >
            <Layers className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
