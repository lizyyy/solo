import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import type { AppState, TabType, ExhibitionItem, ProcessingStatus } from '../data/types';
import { mockArtworks, mockTimelineRecords, mockResidencyRecords, mockExhibitionItems } from '../data/mockData';

interface AppContextType extends AppState {
  setActiveTab: (tab: TabType) => void;
  updateExhibitionItemStatus: (id: string, status: ProcessingStatus, note?: string) => void;
  getArtworkById: (id: string) => typeof mockArtworks[0] | undefined;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [activeTab, setActiveTab] = useState<TabType>('timeline');
  const [timelineRecords] = useState(mockTimelineRecords);
  const [artworks] = useState(mockArtworks);
  const [residencyRecords] = useState(mockResidencyRecords);
  const [exhibitionItems, setExhibitionItems] = useState(mockExhibitionItems);

  useEffect(() => {
    const hash = window.location.hash.replace('#', '') as TabType;
    if (['timeline', 'schedule', 'exhibition'].includes(hash)) {
      setActiveTab(hash);
    }
  }, []);

  useEffect(() => {
    window.location.hash = activeTab;
  }, [activeTab]);

  const value = useMemo<AppContextType>(() => ({
    activeTab,
    setActiveTab: (tab) => {
      setActiveTab(tab);
      window.location.hash = tab;
    },
    timelineRecords,
    artworks,
    residencyRecords,
    exhibitionItems,
    updateExhibitionItemStatus: (id: string, status: ProcessingStatus, note?: string) => {
      setExhibitionItems(prev =>
        prev.map(item =>
          item.id === id
            ? {
                ...item,
                processingStatus: status,
                processingNote: note
                  ? `【人工调整】${note} 处理口径：策展人手动更新状态，原处理记录已归档。`
                  : item.processingNote,
                lastModified: new Date(),
              }
            : item
        )
      );
    },
    getArtworkById: (id) => artworks.find(a => a.id === id),
  }), [activeTab, timelineRecords, artworks, residencyRecords, exhibitionItems]);

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
