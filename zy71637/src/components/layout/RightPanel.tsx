import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Info,
  AlertTriangle,
  Tag,
  FileText,
  ChevronRight,
  X,
} from 'lucide-react';
import { useUIStore } from '../../store/useUIStore';
import { InfoPanel } from '../panels/InfoPanel';
import { AnomalyCard } from '../panels/AnomalyCard';
import { AnnotationList } from '../panels/AnnotationList';
import { ReportPreview } from '../panels/ReportPreview';

type TabType = 'info' | 'anomaly' | 'annotation' | 'report';

export const RightPanel: React.FC = () => {
  const { rightPanelOpen, setRightPanelOpen } = useUIStore();
  const [activeTab, setActiveTab] = useState<TabType>('info');

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'info', label: '详情', icon: <Info size={16} /> },
    { id: 'anomaly', label: '异常', icon: <AlertTriangle size={16} /> },
    { id: 'annotation', label: '标注', icon: <Tag size={16} /> },
    { id: 'report', label: '报告', icon: <FileText size={16} /> },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'info':
        return <InfoPanel />;
      case 'anomaly':
        return <AnomalyCard />;
      case 'annotation':
        return <AnnotationList />;
      case 'report':
        return <ReportPreview />;
      default:
        return <InfoPanel />;
    }
  };

  if (!rightPanelOpen) {
    return (
      <motion.button
        className="absolute right-4 top-1/2 -translate-y-1/2 z-20 flex items-center gap-2 px-3 py-2 bg-slate-800/90 backdrop-blur-md border border-slate-600/50 rounded-xl text-slate-300 hover:text-white hover:bg-slate-700/90 transition-all shadow-lg"
        onClick={() => setRightPanelOpen(true)}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        whileHover={{ x: -2 }}
      >
        <ChevronRight size={18} />
        <span className="text-sm">展开面板</span>
      </motion.button>
    );
  }

  return (
    <motion.div
      className="absolute right-0 top-12 bottom-28 w-96 bg-slate-900/95 backdrop-blur-md border-l border-slate-700/50 shadow-2xl flex flex-col z-10"
      initial={{ x: 400, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 400, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-all ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
        <button
          onClick={() => setRightPanelOpen(false)}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-all"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            className="h-full overflow-y-auto"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
