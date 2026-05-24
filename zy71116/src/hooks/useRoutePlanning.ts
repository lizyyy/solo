import { useEffect, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import { findRoute } from '../utils/pathfinding';

export const useRoutePlanning = () => {
  const {
    campusData,
    selectedStartPoint,
    selectedEndPoint,
    filters,
    currentRoute,
    setCurrentRoute,
    setIsLoading,
  } = useAppStore();

  const planRoute = useCallback(() => {
    if (!campusData || !selectedStartPoint || !selectedEndPoint) {
      return;
    }

    setIsLoading(true);
    
    setTimeout(() => {
      const route = findRoute(campusData, selectedStartPoint, selectedEndPoint, filters);
      setCurrentRoute(route);
      setIsLoading(false);
    }, 300);
  }, [campusData, selectedStartPoint, selectedEndPoint, filters, setCurrentRoute, setIsLoading]);

  useEffect(() => {
    if (selectedStartPoint && selectedEndPoint && campusData) {
      planRoute();
    } else {
      setCurrentRoute(null);
    }
  }, [selectedStartPoint, selectedEndPoint, campusData, filters, planRoute, setCurrentRoute]);

  return {
    currentRoute,
    planRoute,
    canPlan: !!selectedStartPoint && !!selectedEndPoint,
  };
};
