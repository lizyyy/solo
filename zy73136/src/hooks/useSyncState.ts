import { useEffect, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';

type ChangeSource = 'scene' | 'timeline' | 'filter' | 'queue';

export function useSyncState() {
  const {
    selectedBuoyId,
    selectedAnomalyId,
    currentTime,
    filterParams,
    setSelectedBuoy,
    setSelectedAnomaly,
    setExpandedLog,
    setCurrentTime,
    setFilter,
    getAnomaliesByBuoyId,
    getLogsByBuoyId,
    anomalies,
    logs,
  } = useAppStore();

  const syncFromScene = useCallback(
    (buoyId: string) => {
      const buoyAnomalies = getAnomaliesByBuoyId(buoyId);
      if (buoyAnomalies.length > 0) {
        const nearestAnomaly = buoyAnomalies.reduce((nearest, anomaly) => {
          const nearestDiff = Math.abs(nearest.timestamp - currentTime);
          const currentDiff = Math.abs(anomaly.timestamp - currentTime);
          return currentDiff < nearestDiff ? anomaly : nearest;
        });

        setCurrentTime(nearestAnomaly.timestamp, 'scene');
        setFilter({ buoyIds: [buoyId] }, 'scene');
        setSelectedAnomaly(nearestAnomaly.id);
        setExpandedLog(nearestAnomaly.logId);
      } else {
        setFilter({ buoyIds: [buoyId] }, 'scene');
        setSelectedAnomaly(null);
        setExpandedLog(null);
      }
    },
    [
      currentTime,
      getAnomaliesByBuoyId,
      setCurrentTime,
      setFilter,
      setSelectedAnomaly,
      setExpandedLog,
    ]
  );

  const syncFromTimeline = useCallback(
    (time: number) => {
      const activeAnomalies = anomalies.filter(
        (a) => Math.abs(a.timestamp - time) < 30 * 60 * 1000
      );

      if (activeAnomalies.length > 0) {
        const mostSevere = activeAnomalies.reduce((severest, anomaly) => {
          const levelOrder = ['low', 'medium', 'high', 'critical'];
          return levelOrder.indexOf(anomaly.level) > levelOrder.indexOf(severest.level)
            ? anomaly
            : severest;
        });

        setSelectedBuoy(mostSevere.buoyId);
        setSelectedAnomaly(mostSevere.id);
        setExpandedLog(mostSevere.logId);
      }
    },
    [anomalies, setSelectedBuoy, setSelectedAnomaly, setExpandedLog]
  );

  const syncFromFilter = useCallback(
    (newFilter: typeof filterParams) => {
      const filteredAnomalies = anomalies.filter((a) => {
        if (newFilter.riskLevel !== 'all' && a.level !== newFilter.riskLevel) return false;
        if (newFilter.buoyIds.length > 0 && !newFilter.buoyIds.includes(a.buoyId)) return false;
        if (newFilter.parameter !== 'all' && a.parameter !== newFilter.parameter) return false;
        return true;
      });

      if (filteredAnomalies.length > 0 && selectedAnomalyId) {
        const stillVisible = filteredAnomalies.find((a) => a.id === selectedAnomalyId);
        if (!stillVisible) {
          setSelectedAnomaly(null);
          setExpandedLog(null);
        }
      }
    },
    [anomalies, selectedAnomalyId, setSelectedAnomaly, setExpandedLog]
  );

  const syncFromQueue = useCallback(
    (anomalyId: string) => {
      const anomaly = anomalies.find((a) => a.id === anomalyId);
      if (!anomaly) return;

      setCurrentTime(anomaly.timestamp, 'queue');
      setSelectedBuoy(anomaly.buoyId);
      setExpandedLog(anomaly.logId);
      setFilter({ buoyIds: [anomaly.buoyId] }, 'queue');
    },
    [anomalies, setCurrentTime, setSelectedBuoy, setExpandedLog, setFilter]
  );

  const handleBuoyClick = useCallback(
    (buoyId: string) => {
      if (selectedBuoyId === buoyId) {
        setSelectedBuoy(null);
        setSelectedAnomaly(null);
        setExpandedLog(null);
        setFilter({ buoyIds: [] }, 'scene');
      } else {
        setSelectedBuoy(buoyId);
        syncFromScene(buoyId);
      }
    },
    [selectedBuoyId, setSelectedBuoy, setSelectedAnomaly, setExpandedLog, setFilter, syncFromScene]
  );

  const handleAnomalyClick = useCallback(
    (anomalyId: string) => {
      if (selectedAnomalyId === anomalyId) {
        setSelectedAnomaly(null);
        setExpandedLog(null);
      } else {
        setSelectedAnomaly(anomalyId);
        syncFromQueue(anomalyId);
      }
    },
    [selectedAnomalyId, setSelectedAnomaly, setExpandedLog, syncFromQueue]
  );

  const handleTimeChange = useCallback(
    (time: number) => {
      setCurrentTime(time, 'timeline');
      syncFromTimeline(time);
    },
    [setCurrentTime, syncFromTimeline]
  );

  const handleFilterChange = useCallback(
    (newFilter: Partial<typeof filterParams>) => {
      setFilter(newFilter, 'filter');
      syncFromFilter({ ...filterParams, ...newFilter });
    },
    [filterParams, setFilter, syncFromFilter]
  );

  useEffect(() => {
    if (selectedBuoyId && !selectedAnomalyId) {
      const buoyLogs = getLogsByBuoyId(selectedBuoyId);
      if (buoyLogs.length > 0) {
        const nearestLog = buoyLogs.reduce((nearest, log) => {
          const nearestDiff = Math.abs(nearest.timestamp - currentTime);
          const currentDiff = Math.abs(log.timestamp - currentTime);
          return currentDiff < nearestDiff ? log : nearest;
        });
        setExpandedLog(nearestLog.id);
      }
    }
  }, [selectedBuoyId, selectedAnomalyId, currentTime, getLogsByBuoyId, setExpandedLog]);

  return {
    handleBuoyClick,
    handleAnomalyClick,
    handleTimeChange,
    handleFilterChange,
    syncFromScene,
    syncFromTimeline,
    syncFromFilter,
    syncFromQueue,
  };
}
