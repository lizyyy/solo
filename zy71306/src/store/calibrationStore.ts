import { create } from 'zustand';
import {
  AntiSkatingDirection,
  CalibrationError,
  CalibrationParams,
  CalibrationRecord,
  RadiusUnit,
} from '../types/calibration';
import { calculateTorqueBreakdown } from '../services/torqueService';
import { calculateWearBreakdown } from '../services/wearService';
import { detectErrors } from '../services/errorDetection';
import { captureElement, ScreenshotResult } from '../services/screenshotService';
import { generateReport, GeneratedReport } from '../services/reportService';
import { exportToPDF, exportToHTML, downloadBlob, downloadHTML, ExportOptions } from '../services/exportService';
import { loadRecords, saveRecords, generateId } from '../utils/storage';

interface CalibrationState {
  stylusPressure: number;
  antiSkating: number;
  antiSkatingDirection: AntiSkatingDirection;
  tonearmLength: number;
  recordRadius: number;
  recordRadiusUnit: RadiusUnit;
  testTrack: string;

  torque: number;
  wearLevel: number;
  errors: CalibrationError[];

  records: CalibrationRecord[];
  selectedRecords: string[];

  currentNote: string;
  currentCorrection: string;
  currentScreenshot: string | null;

  isCalculating: boolean;
  isScreenshotting: boolean;
  isExporting: boolean;
  lastError: string | null;

  generatedReport: GeneratedReport | null;

  setStylusPressure: (v: number) => void;
  setAntiSkating: (v: number) => void;
  setAntiSkatingDirection: (d: AntiSkatingDirection) => void;
  setTonearmLength: (v: number) => void;
  setRecordRadius: (v: number) => void;
  setRecordRadiusUnit: (u: RadiusUnit) => void;
  setTestTrack: (t: string) => void;
  calculate: () => void;
  takeScreenshot: (elementId: string) => Promise<void>;
  saveRecord: () => void;
  deleteRecord: (id: string) => void;
  selectRecordForCompare: (id: string) => void;
  clearSelectedRecords: () => void;
  setCurrentNote: (n: string) => void;
  setCurrentCorrection: (c: string) => void;
  generateCalibrationReport: (recordIds: string[], additionalNotes?: string) => void;
  exportReportPDF: (options?: ExportOptions) => Promise<void>;
  exportReportHTML: (options?: ExportOptions) => Promise<void>;
  clearCurrentScreenshot: () => void;
  clearAll: () => void;
  setError: (error: string | null) => void;
  loadStoredRecords: () => void;
}

export const useCalibrationStore = create<CalibrationState>((set, get) => ({
  stylusPressure: 1.8,
  antiSkating: 0.5,
  antiSkatingDirection: 'normal',
  tonearmLength: 250,
  recordRadius: 14,
  recordRadiusUnit: 'cm',
  testTrack: 'blank-groove',

  torque: 0,
  wearLevel: 0,
  errors: [],

  records: [],
  selectedRecords: [],

  currentNote: '',
  currentCorrection: '',
  currentScreenshot: null,

  isCalculating: false,
  isScreenshotting: false,
  isExporting: false,
  lastError: null,

  generatedReport: null,

  setStylusPressure: (v: number) => {
    set({ stylusPressure: v });
    get().calculate();
  },

  setAntiSkating: (v: number) => {
    set({ antiSkating: v });
    get().calculate();
  },

  setAntiSkatingDirection: (d: AntiSkatingDirection) => {
    set({ antiSkatingDirection: d });
    get().calculate();
  },

  setTonearmLength: (v: number) => {
    set({ tonearmLength: v });
    get().calculate();
  },

  setRecordRadius: (v: number) => {
    set({ recordRadius: v });
    get().calculate();
  },

  setRecordRadiusUnit: (u: RadiusUnit) => {
    set({ recordRadiusUnit: u });
    get().calculate();
  },

  setTestTrack: (t: string) => {
    set({ testTrack: t });
    get().calculate();
  },

  calculate: () => {
    const state = get();
    const params: CalibrationParams = {
      stylusPressure: state.stylusPressure,
      antiSkating: state.antiSkating,
      antiSkatingDirection: state.antiSkatingDirection,
      tonearmLength: state.tonearmLength,
      recordRadius: state.recordRadius,
      recordRadiusUnit: state.recordRadiusUnit,
      testTrack: state.testTrack,
    };

    const torqueBreakdown = calculateTorqueBreakdown(params);
    const wearBreakdown = calculateWearBreakdown(params);
    const errors = detectErrors(params);

    set({
      torque: torqueBreakdown.totalTorque,
      wearLevel: wearBreakdown.totalWear,
      errors,
    });
  },

  takeScreenshot: async (elementId: string) => {
    set({ isScreenshotting: true, lastError: null });
    try {
      const result: ScreenshotResult = await captureElement(elementId);
      if (result.success && result.dataUrl) {
        set({ currentScreenshot: result.dataUrl });
      } else {
        set({
          currentScreenshot: result.fallbackDataUrl || null,
          lastError: result.error || '截图失败',
        });
      }
    } catch (error) {
      set({
        lastError: error instanceof Error ? error.message : '截图失败',
      });
    } finally {
      set({ isScreenshotting: false });
    }
  },

  saveRecord: () => {
    const state = get();
    const newRecord: CalibrationRecord = {
      id: generateId(),
      timestamp: Date.now(),
      stylusPressure: state.stylusPressure,
      antiSkating: state.antiSkating,
      antiSkatingDirection: state.antiSkatingDirection,
      tonearmLength: state.tonearmLength,
      recordRadius: state.recordRadius,
      recordRadiusUnit: state.recordRadiusUnit,
      testTrack: state.testTrack,
      torque: state.torque,
      wearLevel: state.wearLevel,
      errors: [...state.errors],
      screenshot: state.currentScreenshot,
      notes: state.currentNote,
      manualCorrection: state.currentCorrection,
    };

    const updatedRecords = [newRecord, ...state.records];
    set({
      records: updatedRecords });
    saveRecords(updatedRecords);

    set({
      currentNote: '',
      currentCorrection: '',
      currentScreenshot: null,
    });
  },

  deleteRecord: (id: string) => {
    const updatedRecords = get().records.filter((r) => r.id !== id);
    set({ records: updatedRecords });
    saveRecords(updatedRecords);

    const updatedSelected = get().selectedRecords.filter((rid) => rid !== id);
    set({ selectedRecords: updatedSelected });
  },

  selectRecordForCompare: (id: string) => {
    const current = get().selectedRecords;
    if (current.includes(id)) {
      set({ selectedRecords: current.filter((r) => r !== id) });
    } else if (current.length < 5) {
      set({ selectedRecords: [...current, id] });
    }
  },

  clearSelectedRecords: () => {
    set({ selectedRecords: [] });
  },

  setCurrentNote: (n: string) => {
    set({ currentNote: n });
  },

  setCurrentCorrection: (c: string) => {
    set({ currentCorrection: c });
  },

  generateCalibrationReport: (recordIds: string[], additionalNotes: string = '') => {
    const state = get();
    const recordsToExport = state.records.filter((r) => recordIds.includes(r.id));
    const report = generateReport(recordsToExport, additionalNotes);
    set({ generatedReport: report });
  },

  exportReportPDF: async (options: ExportOptions = {}) => {
    const state = get();
    if (!state.generatedReport) return;

    set({ isExporting: true, lastError: null });

    try {
      const recordsToExport = state.records.filter((r) =>
        state.generatedReport!.recordIds.includes(r.id));
      const result = await exportToPDF(state.generatedReport, recordsToExport, options);

      if (result.success && result.blob) {
        downloadBlob(result.blob, `校准报告_${Date.now()}.pdf`);
      } else if (result.fallbackHtml) {
        downloadHTML(result.fallbackHtml, `校准报告_${Date.now()}.html`);
        set({
          lastError: result.error || 'PDF导出失败，已导出HTML版本',
        });
      }
    } catch (error) {
      set({
        lastError: error instanceof Error ? error.message : '导出失败'});
    } finally {
      set({ isExporting: false });
    }
  },

  exportReportHTML: async (options: ExportOptions = {}) => {
    const state = get();
    if (!state.generatedReport) return;

    set({ isExporting: true, lastError: null });

    try {
      const recordsToExport = state.records.filter((r) =>
        state.generatedReport!.recordIds.includes(r.id));
      const html = exportToHTML(state.generatedReport, recordsToExport, options);
      downloadHTML(html, `校准报告_${Date.now()}.html`);
    } catch (error) {
      set({
        lastError: error instanceof Error ? error.message : '导出失败'});
    } finally {
      set({ isExporting: false });
    }
  },

  clearCurrentScreenshot: () => {
    set({ currentScreenshot: null });
  },

  clearAll: () => {
    set({
      stylusPressure: 1.8,
      antiSkating: 0.5,
      antiSkatingDirection: 'normal',
      tonearmLength: 250,
      recordRadius: 14,
      recordRadiusUnit: 'cm',
      testTrack: 'blank-groove',
      currentNote: '',
      currentCorrection: '',
      currentScreenshot: null,
      lastError: null,
      generatedReport: null,
    });
    get().calculate();
  },

  setError: (error: string | null) => {
    set({ lastError: error });
  },

  loadStoredRecords: () => {
    const stored = loadRecords();
    set({ records: stored });
  },
}));
