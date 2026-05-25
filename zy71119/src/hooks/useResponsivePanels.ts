import { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';

export const useResponsivePanels = () => {
  useEffect(() => {
    const handleResize = () => {
      const isNarrowScreen = window.innerWidth < 1024;
      const state = useAppStore.getState();
      
      if (isNarrowScreen && state.leftPanelOpen && state.rightPanelOpen) {
        useAppStore.setState({ rightPanelOpen: false });
      }
    };

    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
};
