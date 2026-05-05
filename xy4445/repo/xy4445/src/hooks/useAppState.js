import { useState, useEffect, useCallback } from 'react';
import { assessHiveRisks } from '../utils/riskDetector';
import {
  loadHives, saveHives,
  loadSensorData, saveSensorData,
  loadInspectionRecords, saveInspectionRecords,
  loadWateringSchedules, saveWateringSchedules,
  loadReviewNotes, saveReviewNotes,
  saveReviewNoteForHive
} from '../utils/storage';

export const useAppState = () => {
  const [hives, setHives] = useState([]);
  const [sensorData, setSensorData] = useState([]);
  const [inspectionRecords, setInspectionRecords] = useState([]);
  const [wateringSchedules, setWateringSchedules] = useState([]);
  const [reviewNotes, setReviewNotes] = useState({});
  const [riskAssessments, setRiskAssessments] = useState([]);
  const [selectedHive, setSelectedHive] = useState(null);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  useEffect(() => {
    const loadData = () => {
      setHives(loadHives());
      setSensorData(loadSensorData());
      setInspectionRecords(loadInspectionRecords());
      setWateringSchedules(loadWateringSchedules());
      setReviewNotes(loadReviewNotes());
      setIsDataLoaded(true);
    };

    loadData();
  }, []);

  useEffect(() => {
    if (!isDataLoaded) return;

    saveHives(hives);
    saveSensorData(sensorData);
    saveInspectionRecords(inspectionRecords);
    saveWateringSchedules(wateringSchedules);
    saveReviewNotes(reviewNotes);
  }, [hives, sensorData, inspectionRecords, wateringSchedules, reviewNotes, isDataLoaded]);

  useEffect(() => {
    if (hives.length === 0) {
      setRiskAssessments([]);
      return;
    }

    const assessments = hives.map(hive => {
      const hiveSensorData = sensorData.find(s => s.hiveId === hive.id);
      const hiveInspectionRecords = inspectionRecords.filter(r => r.hiveId === hive.id);
      const hiveWateringSchedule = wateringSchedules.find(s => s.hiveId === hive.id);

      return assessHiveRisks(
        hive,
        hiveSensorData,
        hiveInspectionRecords,
        hiveWateringSchedule,
        hives
      );
    });

    setRiskAssessments(assessments);
  }, [hives, sensorData, inspectionRecords, wateringSchedules]);

  const addHives = useCallback((newHives) => {
    setHives(prevHives => {
      const existingIds = new Set(prevHives.map(h => h.id));
      const hivesToAdd = newHives.filter(h => !existingIds.has(h.id));
      return [...prevHives, ...hivesToAdd];
    });
  }, []);

  const updateHive = useCallback((hiveId, updates) => {
    setHives(prevHives => 
      prevHives.map(hive => 
        hive.id === hiveId ? { ...hive, ...updates } : hive
      )
    );
  }, []);

  const addSensorData = useCallback((newSensorData) => {
    setSensorData(prevData => {
      const existingIds = new Set(prevData.map(s => s.hiveId));
      const dataToAdd = newSensorData.filter(s => !existingIds.has(s.hiveId));
      return [...prevData, ...dataToAdd];
    });
  }, []);

  const addInspectionRecords = useCallback((newRecords) => {
    setInspectionRecords(prevRecords => [...prevRecords, ...newRecords]);
  }, []);

  const addWateringSchedules = useCallback((newSchedules) => {
    setWateringSchedules(prevSchedules => {
      const existingIds = new Set(prevSchedules.map(s => s.hiveId));
      const schedulesToAdd = newSchedules.filter(s => !existingIds.has(s.hiveId));
      return [...prevSchedules, ...schedulesToAdd];
    });
  }, []);

  const updateReviewNote = useCallback((hiveId, note) => {
    saveReviewNoteForHive(hiveId, note);
    setReviewNotes(prevNotes => ({
      ...prevNotes,
      [hiveId]: {
        ...prevNotes[hiveId],
        ...note,
        updatedAt: new Date().toISOString()
      }
    }));
  }, []);

  const getHiveRiskAssessment = useCallback((hiveId) => {
    return riskAssessments.find(a => a.hiveId === hiveId);
  }, [riskAssessments]);

  const getHiveSensorData = useCallback((hiveId) => {
    return sensorData.find(s => s.hiveId === hiveId);
  }, [sensorData]);

  const getHiveInspectionRecords = useCallback((hiveId) => {
    return inspectionRecords.filter(r => r.hiveId === hiveId);
  }, [inspectionRecords]);

  const getHiveWateringSchedule = useCallback((hiveId) => {
    return wateringSchedules.find(s => s.hiveId === hiveId);
  }, [wateringSchedules]);

  const clearAllData = useCallback(() => {
    setHives([]);
    setSensorData([]);
    setInspectionRecords([]);
    setWateringSchedules([]);
    setReviewNotes({});
    setRiskAssessments([]);
    setSelectedHive(null);
  }, []);

  return {
    hives,
    sensorData,
    inspectionRecords,
    wateringSchedules,
    reviewNotes,
    riskAssessments,
    selectedHive,
    isDataLoaded,
    setSelectedHive,
    addHives,
    updateHive,
    addSensorData,
    addInspectionRecords,
    addWateringSchedules,
    updateReviewNote,
    getHiveRiskAssessment,
    getHiveSensorData,
    getHiveInspectionRecords,
    getHiveWateringSchedule,
    clearAllData
  };
};
