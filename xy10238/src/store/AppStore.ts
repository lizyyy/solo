import { useState } from 'react';
import type { HouseType, ElectricityPrice, WeatherData, EnergyConsumption, ValidationError } from '../types';
import type { ImportRecord } from '../utils/dataImport';
import { parseCSV, parseJSON, parseConsumptionRecord, detectDuplicates, exportToCSV, exportToJSON } from '../utils/dataImport';
import { normalizeConsumption } from '../utils/houseNormalization';
import { applyWeatherCorrection } from '../utils/weatherCorrection';
import { calculateCost } from '../utils/electricityPrice';
import {
  sampleHouseTypes, sampleElectricityPrices, getReferenceWeather, getActualWeather, generateSampleConsumptions
} from '../data/sampleData';

export const useAppStore = () => {
  const [houseTypes, setHouseTypes] = useState<HouseType[]>(sampleHouseTypes);
  const [prices, setPrices] = useState<ElectricityPrice[]>(sampleElectricityPrices);
  const [weatherData] = useState<Map<string, WeatherData[]>>(() => {
    const map = new Map<string, WeatherData[]>();
    sampleHouseTypes.forEach((house) => {
      map.set(`${house.id}-reference`, getReferenceWeather(house.id));
      map.set(`${house.id}-actual`, getActualWeather(house.id));
    });
    return map;
  });
  const [consumptions, setConsumptions] = useState<EnergyConsumption[]>([]);
  const [importRecords, setImportRecords] = useState<ImportRecord[]>([]);
  const [currentTab, setCurrentTab] = useState<'import' | 'normalization' | 'weather' | 'comparison'>('import');
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [loadingSample, setLoadingSample] = useState(false);

  const loadSampleData = () => {
    setLoadingSample(true);
    const samples = generateSampleConsumptions();
    
    const processed = samples.map((c) => {
      const house = houseTypes.find((h) => h.id === c.houseTypeId);
      const actualWeather = weatherData.get(`${c.houseTypeId}-actual`) || [];
      const refWeather = weatherData.get(`${c.houseTypeId}-reference`) || [];
      
      const actualMonth = actualWeather.find((w) => w.month === c.month);
      const refMonth = refWeather.find((w) => w.month === c.month);

      let consumption = { ...c };

      if (house) {
        consumption.normalizedConsumption = normalizeConsumption(consumption, house);
      }

      if (actualMonth && refMonth && house) {
        const { correctedConsumption, correctionFactor } = applyWeatherCorrection(
          consumption,
          actualMonth,
          refMonth
        );
        consumption.weatherCorrectedConsumption = correctedConsumption;
        consumption.weatherCorrectionFactor = correctionFactor;
      }

      const price = prices.find((p) => p.id === c.electricityPriceId);
      if (price) {
        const cost = calculateCost(consumption, price);
        consumption.estimatedCost = cost.totalCost;
      }

      return consumption;
    });

    setConsumptions(processed);
    setLoadingSample(false);
  };

  const processImportData = (content: string, format: 'csv' | 'json') => {
    const records = format === 'csv' ? parseCSV(content) : parseJSON(content);
    const allWeatherData = Array.from(weatherData.values()).flatMap((w) => w);
    
    const parsedRecords: ImportRecord[] = records.map((raw, index) => {
      const { parsed, validation } = parseConsumptionRecord(
        raw,
        houseTypes,
        allWeatherData,
        prices,
        index + 1
      );

      let record: ImportRecord = {
        rowIndex: index + 1,
        rawData: raw,
        parsed,
        validation,
        status: validation.isValid ? 'valid' : 'error',
      };

      if (parsed) {
        const house = houseTypes.find((h) => h.id === parsed.houseTypeId);
        const actualWeather = weatherData.get(`${parsed.houseTypeId}-actual`) || [];
        const refWeather = weatherData.get(`${parsed.houseTypeId}-reference`) || [];
        
        const actualMonth = actualWeather.find((w) => w.month === parsed.month);
        const refMonth = refWeather.find((w) => w.month === parsed.month);

        if (house) {
          record.parsed!.normalizedConsumption = normalizeConsumption(parsed, house);
        }

        if (actualMonth && refMonth && house) {
          const { correctedConsumption, correctionFactor } = applyWeatherCorrection(
            parsed,
            actualMonth,
            refMonth
          );
          record.parsed!.weatherCorrectedConsumption = correctedConsumption;
          record.parsed!.weatherCorrectionFactor = correctionFactor;
        }

        const price = prices.find((p) => p.id === parsed.electricityPriceId);
        if (price) {
          const cost = calculateCost(record.parsed!, price);
          record.parsed!.estimatedCost = cost.totalCost;
        }
      }

      return record;
    });

    const withDuplicates = detectDuplicates(parsedRecords, consumptions);
    setImportRecords(withDuplicates);

    const errors = withDuplicates
      .flatMap((r) => r.validation.errors)
      .filter((e) => e !== undefined) as ValidationError[];
    setValidationErrors(errors);
  };

  const confirmImportRecord = (rowIndex: number) => {
    setImportRecords((prev) =>
      prev.map((r) =>
        r.rowIndex === rowIndex ? { ...r, status: 'confirmed' } : r
      )
    );
  };

  const rejectImportRecord = (rowIndex: number) => {
    setImportRecords((prev) =>
      prev.map((r) =>
        r.rowIndex === rowIndex ? { ...r, status: 'rejected' } : r
      )
    );
  };

  const confirmAllImportRecords = () => {
    setImportRecords((prev) =>
      prev.map((r) => (r.status === 'valid' ? { ...r, status: 'confirmed' } : r))
    );
  };

  const saveConfirmedRecords = () => {
    const toSave = importRecords
      .filter((r) => r.status === 'confirmed' && r.parsed)
      .map((r) => r.parsed!);

    setConsumptions((prev) => [...prev, ...toSave]);
    setImportRecords([]);
    setValidationErrors([]);
  };

  const clearImportRecords = () => {
    setImportRecords([]);
    setValidationErrors([]);
  };

  const addManualConsumption = (consumption: Omit<EnergyConsumption, 'id'>) => {
    const newConsumption = { ...consumption, id: generateId() };
    setConsumptions((prev) => [...prev, newConsumption]);
  };

  const updateConsumption = (id: string, updates: Partial<EnergyConsumption>) => {
    setConsumptions((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );
  };

  const deleteConsumption = (id: string) => {
    setConsumptions((prev) => prev.filter((c) => c.id !== id));
  };

  const exportConsumptionsAsCSV = () => {
    return exportToCSV(consumptions, houseTypes, prices);
  };

  const exportConsumptionsAsJSON = () => {
    return exportToJSON(consumptions, houseTypes, prices);
  };

  const generateId = (): string => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  };

  return {
    houseTypes,
    setHouseTypes,
    prices,
    setPrices,
    weatherData,
    consumptions,
    setConsumptions,
    importRecords,
    currentTab,
    setCurrentTab,
    validationErrors,
    loadingSample,
    loadSampleData,
    processImportData,
    confirmImportRecord,
    rejectImportRecord,
    confirmAllImportRecords,
    saveConfirmedRecords,
    clearImportRecords,
    addManualConsumption,
    updateConsumption,
    deleteConsumption,
    exportConsumptionsAsCSV,
    exportConsumptionsAsJSON,
  };
};
