import { useCallback } from 'react';
import { useDataStore } from '../store/useDataStore';
import { useGameEngine } from './useGameEngine';
import { parseTourData } from '../utils/parsers/fileParser';
import {
  validateTourData,
  validateStopsData,
  validateMerchData,
  cleanTourData,
  cleanStopsData,
  cleanMerchData,
} from '../utils/validators/dataValidator';
import type { Tour, Stop, MerchItem, ProcessingLogEntry } from '../types/tour';

export function useDataImport() {
  const {
    rawFiles,
    parsedData,
    processingLog,
    validationErrors,
    isDirty,
    isProcessing,
    setRawFiles,
    setParsedData,
    addProcessingLog,
    addValidationErrors,
    resolveProcessingLog,
    clearValidationError,
    setIsProcessing,
    clearData,
    markAsDirty,
  } = useDataStore();

  const { initializeTour, goToPhase } = useGameEngine();

  const importFiles = useCallback(
    async (files: File[]): Promise<boolean> => {
      setIsProcessing(true);
      setRawFiles(files);
      useDataStore.getState().processingLog.length = 0;

      try {
        const result = await parseTourData(files);

        const tourErrors = validateTourData(result.tour);
        const stopsErrors = validateStopsData(result.stops);
        const merchErrors = validateMerchData(result.merch);

        const { cleaned: cleanedTour, logs: tourLogs } = cleanTourData(
          result.tour,
          result.rawData.tour
        );
        const { cleaned: cleanedStops, logs: stopsLogs } = cleanStopsData(
          result.stops,
          result.rawData.stops
        );
        const { cleaned: cleanedMerch, logs: merchLogs } = cleanMerchData(
          result.merch,
          result.rawData.merch
        );

        useDataStore.getState().addProcessingLog([...tourLogs, ...stopsLogs, ...merchLogs]);
        useDataStore.getState().addValidationErrors([...tourErrors, ...stopsErrors, ...merchErrors]);

        setParsedData({
          tour: cleanedTour,
          stops: cleanedStops,
          merch: cleanedMerch,
        });

        const hasCriticalErrors = [...tourErrors, ...stopsErrors, ...merchErrors].some(
          (e) => e.severity === 'error'
        );

        setIsProcessing(false);
        markAsDirty();

        return !hasCriticalErrors;
      } catch (error) {
        setIsProcessing(false);
        console.error('导入数据失败:', error);
        return false;
      }
    },
    [setRawFiles, setParsedData, setIsProcessing, markAsDirty]
  );

  const importSampleData = useCallback(
    async (sampleType: 'normal' | 'critical' | 'dirty'): Promise<boolean> => {
      setIsProcessing(true);
      useDataStore.getState().processingLog.splice(0, useDataStore.getState().processingLog.length);
      useDataStore.getState().validationErrors.splice(0, useDataStore.getState().validationErrors.length);

      try {
        const basePath = `/src/data/sample-${sampleType}`;
        
        const [tourRes, stopsRes, merchRes] = await Promise.all([
          fetch(`${basePath}/tour.csv`),
          fetch(`${basePath}/stops.csv`),
          fetch(`${basePath}/merch.csv`),
        ]);

        const [tourText, stopsText, merchText] = await Promise.all([
          tourRes.text(),
          stopsRes.text(),
          merchRes.text(),
        ]);

        const Papa = (await import('papaparse')).default;

        const parseCSV = (text: string) => {
          return new Promise<any[]>((resolve) => {
            Papa.parse(text, {
              header: true,
              skipEmptyLines: true,
              complete: (results) => {
                resolve(results.data);
              },
            });
          });
        };

        const [tourData, stopsData, merchData] = await Promise.all([
          parseCSV(tourText),
          parseCSV(stopsText),
          parseCSV(merchText),
        ]);

        const tourRow = tourData[0] || {};
        const fieldMapping: Record<string, string> = {
          tour_name: 'name',
          band_name: 'bandName',
          initial_budget: 'initialBudget',
          start_date: 'startDate',
          end_date: 'endDate',
        };

        const mappedTour: Partial<Tour> = {};
        Object.keys(tourRow).forEach((key) => {
          const mappedKey = fieldMapping[key] || key;
          (mappedTour as any)[mappedKey] = tourRow[key];
        });

        const stopFieldMapping: Record<string, string> = {
          distance_from_prev: 'distanceFromPrev',
          venue_rent: 'venueRent',
          venue_split: 'venueSplit',
          ticket_price: 'ticketPrice',
          predicted_attendance: 'predictedAttendance',
          transport_type: 'transportType',
          transport_cost: 'transportCost',
        };

        const mappedStops: Partial<Stop>[] = stopsData.map((row) => {
          const stop: Partial<Stop> = {};
          Object.keys(row).forEach((key) => {
            const mappedKey = stopFieldMapping[key] || key;
            (stop as any)[mappedKey] = row[key];
          });
          return stop;
        });

        const merchFieldMapping: Record<string, string> = {
          cost_price: 'costPrice',
          selling_price: 'sellingPrice',
          initial_stock: 'initialStock',
        };

        const mappedMerch: Partial<MerchItem>[] = merchData.map((row) => {
          const item: Partial<MerchItem> = {};
          Object.keys(row).forEach((key) => {
            const mappedKey = merchFieldMapping[key] || key;
            (item as any)[mappedKey] = row[key];
          });
          return item;
        });

        const rawData = {
          tour: tourRow,
          stops: stopsData,
          merch: merchData,
        };

        const tourErrors = validateTourData(mappedTour);
        const stopsErrors = validateStopsData(mappedStops);
        const merchErrors = validateMerchData(mappedMerch);

        const { cleaned: cleanedTour, logs: tourLogs } = cleanTourData(mappedTour, rawData.tour);
        const { cleaned: cleanedStops, logs: stopsLogs } = cleanStopsData(mappedStops, rawData.stops);
        const { cleaned: cleanedMerch, logs: merchLogs } = cleanMerchData(mappedMerch, rawData.merch);

        useDataStore.getState().addProcessingLog([...tourLogs, ...stopsLogs, ...merchLogs]);
        useDataStore.getState().addValidationErrors([...tourErrors, ...stopsErrors, ...merchErrors]);

        setParsedData({
          tour: cleanedTour,
          stops: cleanedStops,
          merch: cleanedMerch,
        });

        setIsProcessing(false);
        markAsDirty();

        return true;
      } catch (error) {
        setIsProcessing(false);
        console.error('导入样例数据失败:', error);
        return false;
      }
    },
    [setParsedData, setIsProcessing, markAsDirty]
  );

  const canStartGame = useCallback((): boolean => {
    if (!parsedData.tour.name || !parsedData.tour.initialBudget) return false;
    if (!parsedData.tour.startDate || !parsedData.tour.endDate) return false;
    if (parsedData.stops.length === 0) return false;
    if (parsedData.merch.length === 0) return false;

    const hasCriticalErrors = validationErrors.some((e) => e.severity === 'error');
    if (hasCriticalErrors) return false;

    return true;
  }, [parsedData, validationErrors]);

  const startGameWithData = useCallback((): boolean => {
    if (!canStartGame()) return false;

    const tour = parsedData.tour;
    const stops = parsedData.stops;
    const merch = parsedData.merch;

    if (
      !tour.name ||
      tour.initialBudget === undefined ||
      !tour.startDate ||
      !tour.endDate
    ) {
      return false;
    }

    const allStopsValid = stops.every(
      (s) =>
        s.city &&
        s.venue &&
        s.date &&
        s.venueRent !== undefined &&
        s.ticketPrice !== undefined &&
        s.predictedAttendance !== undefined
    );

    if (!allStopsValid) return false;

    const allMerchValid = merch.every(
      (m) =>
        m.name &&
        m.costPrice !== undefined &&
        m.sellingPrice !== undefined &&
        m.initialStock !== undefined
    );

    if (!allMerchValid) return false;

    const rawTourData = rawFiles.length > 0 ? parsedData.tour : {};
    const rawStopsData = rawFiles.length > 0 ? parsedData.stops : [];
    const rawMerchData = rawFiles.length > 0 ? parsedData.merch : [];

    initializeTour(
      {
        id: '',
        name: tour.name,
        bandName: tour.bandName,
        initialBudget: tour.initialBudget,
        startDate: tour.startDate,
        endDate: tour.endDate,
        notes: tour.notes,
        rawData: {
          tour: rawTourData,
          stops: rawStopsData,
          merch: rawMerchData,
        },
        processingLog: [...processingLog],
      },
      stops.map((s) => ({
        city: s.city!,
        venue: s.venue!,
        date: s.date!,
        distanceFromPrev: s.distanceFromPrev || 0,
        venueRent: s.venueRent!,
        venueSplit: s.venueSplit || 0,
        ticketPrice: s.ticketPrice!,
        predictedAttendance: s.predictedAttendance!,
        transportType: s.transportType || '巴士',
        transportCost: s.transportCost || 0,
        notes: s.notes,
      })),
      merch.map((m) => ({
        name: m.name!,
        sku: m.sku,
        costPrice: m.costPrice!,
        sellingPrice: m.sellingPrice!,
        initialStock: m.initialStock!,
        currentStock: m.currentStock || m.initialStock!,
        notes: m.notes,
      }))
    );

    goToPhase('playing');
    return true;
  }, [parsedData, rawFiles, processingLog, canStartGame, initializeTour, goToPhase]);

  const resolveLogEntry = useCallback(
    (entryId: string, userOverride?: string) => {
      resolveProcessingLog(entryId, userOverride);
      markAsDirty();
    },
    [resolveProcessingLog, markAsDirty]
  );

  const dismissError = useCallback(
    (errorId: string) => {
      clearValidationError(errorId);
      markAsDirty();
    },
    [clearValidationError, markAsDirty]
  );

  const getProcessingLogByPriority = useCallback((): ProcessingLogEntry[] => {
    return [...processingLog].sort((a, b) => a.priority - b.priority);
  }, [processingLog]);

  const getErrorsBySeverity = useCallback(
    (severity: 'error' | 'warning') => {
      return validationErrors.filter((e) => e.severity === severity);
    },
    [validationErrors]
  );

  return {
    // State
    rawFiles,
    parsedData,
    processingLog,
    validationErrors,
    isDirty,
    isProcessing,

    // Actions
    importFiles,
    importSampleData,
    canStartGame,
    startGameWithData,
    resolveLogEntry,
    dismissError,
    clearData,

    // Queries
    getProcessingLogByPriority,
    getErrorsBySeverity,
  };
}
