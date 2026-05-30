import { create } from 'zustand';
import type { ModalRecord, RecordStatus, AuditEntry, ParameterSnapshot, FrequencyPeak, BoxDimensions, SoundHole, WoodMaterial, LengthUnit, DensityUnit, ValidationError } from '@/types';
import { validateAll } from '@/utils/validation';
import { calculateAllPeaks } from '@/utils/modalCalculation';
import { SAMPLE_PROBLEM_RECORDS, exportRecord } from '@/utils/sampleData';
import { importAndValidate } from '@/utils/importExport';
import { convertLength, convertDensity } from '@/utils/unitConversion';

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

const STORAGE_KEY = 'guitar-modal-records';

function loadRecords(): ModalRecord[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return SAMPLE_PROBLEM_RECORDS as ModalRecord[];
}

function saveRecords(records: ModalRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

interface GuitarStore {
  records: ModalRecord[];
  currentRecord: ModalRecord | null;
  selectedRecordIds: string[];
  statusFilter: RecordStatus | 'all';

  inputBoxDims: BoxDimensions;
  inputSoundHole: SoundHole;
  inputWood: WoodMaterial;
  inputLengthUnit: LengthUnit;
  inputDensityUnit: DensityUnit;
  inputName: string;
  inputSource: 'manual' | 'import';
  inputSourceDetail: string;

  validationErrors: ValidationError[];

  setRecords: (records: ModalRecord[]) => void;
  addRecord: (record: ModalRecord) => void;
  updateRecord: (id: string, updates: Partial<ModalRecord>) => void;
  deleteRecord: (id: string) => void;
  setCurrentRecord: (record: ModalRecord | null) => void;
  toggleSelectRecord: (id: string) => void;
  setStatusFilter: (filter: RecordStatus | 'all') => void;

  setInputBoxDims: (dims: BoxDimensions) => void;
  setInputSoundHole: (sh: SoundHole) => void;
  setInputWood: (wood: WoodMaterial) => void;
  setInputLengthUnit: (unit: LengthUnit) => void;
  setInputDensityUnit: (unit: DensityUnit) => void;
  setInputName: (name: string) => void;
  setInputSource: (source: 'manual' | 'import', detail: string) => void;

  validateInput: () => void;
  submitRecord: (operator: string, reason: string) => ModalRecord | null;
  changeStatus: (id: string, status: RecordStatus, operator: string, reason: string) => void;
  exportRecordById: (id: string) => string;
  exportSelected: () => string;
  importData: (text: string, format: 'json' | 'csv') => { success: number; failed: number; errors: string[][] };
  loadSampleData: () => void;
  resetInputs: () => void;
  editRecord: (id: string, params: ParameterSnapshot, operator: string, reason: string) => void;
}

const defaultBoxDims: BoxDimensions = { length: 480, width: 350, depth: 100 };
const defaultSoundHole: SoundHole = { diameter: 88, position: '面板中央' };
const defaultWood: WoodMaterial = { name: '云杉 (Sitka Spruce)', density: 430, elasticModulus: 11.5, isCustom: false };

export const useGuitarStore = create<GuitarStore>((set, get) => ({
  records: loadRecords(),
  currentRecord: null,
  selectedRecordIds: [],
  statusFilter: 'all',

  inputBoxDims: { ...defaultBoxDims },
  inputSoundHole: { ...defaultSoundHole },
  inputWood: { ...defaultWood },
  inputLengthUnit: 'mm',
  inputDensityUnit: 'kg_m3',
  inputName: '',
  inputSource: 'manual',
  inputSourceDetail: '',
  validationErrors: [],

  setRecords: (records) => {
    set({ records });
    saveRecords(records);
  },

  addRecord: (record) => {
    const records = [...get().records, record];
    set({ records });
    saveRecords(records);
  },

  updateRecord: (id, updates) => {
    const records = get().records.map((r) => (r.id === id ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r));
    set({ records });
    saveRecords(records);
  },

  deleteRecord: (id) => {
    const records = get().records.filter((r) => r.id !== id);
    set({ records });
    saveRecords(records);
  },

  setCurrentRecord: (record) => set({ currentRecord: record }),
  toggleSelectRecord: (id) => {
    const selected = get().selectedRecordIds;
    set({
      selectedRecordIds: selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id],
    });
  },

  setStatusFilter: (filter) => set({ statusFilter: filter }),

  setInputBoxDims: (dims) => {
    set({ inputBoxDims: dims });
    get().validateInput();
  },
  setInputSoundHole: (sh) => {
    set({ inputSoundHole: sh });
    get().validateInput();
  },
  setInputWood: (wood) => {
    set({ inputWood: wood });
    get().validateInput();
  },
  setInputLengthUnit: (unit) => {
    const oldUnit = get().inputLengthUnit;
    const dims = get().inputBoxDims;
    const sh = get().inputSoundHole;
    const convertedLength = convertLength(dims.length, oldUnit, unit);
    const convertedWidth = convertLength(dims.width, oldUnit, unit);
    const convertedDepth = convertLength(dims.depth, oldUnit, unit);
    const convertedDia = convertLength(sh.diameter, oldUnit, unit);
    set({
      inputLengthUnit: unit,
      inputBoxDims: {
        length: convertedLength.convertedValue,
        width: convertedWidth.convertedValue,
        depth: convertedDepth.convertedValue,
      },
      inputSoundHole: {
        ...sh,
        diameter: convertedDia.convertedValue,
      },
    });
    get().validateInput();
  },
  setInputDensityUnit: (unit) => {
    const oldUnit = get().inputDensityUnit;
    const wood = get().inputWood;
    const convertedDensity = convertDensity(wood.density, oldUnit, unit);
    set({
      inputDensityUnit: unit,
      inputWood: {
        ...wood,
        density: convertedDensity.convertedValue,
      },
    });
    get().validateInput();
  },
  setInputName: (name) => set({ inputName: name }),
  setInputSource: (source, detail) => set({ inputSource: source, inputSourceDetail: detail }),

  validateInput: () => {
    const { inputBoxDims, inputSoundHole, inputWood, inputLengthUnit, inputDensityUnit } = get();
    const errors = validateAll(inputBoxDims, inputSoundHole, inputWood, inputLengthUnit, inputDensityUnit);
    set({ validationErrors: errors });
  },

  submitRecord: (operator, reason) => {
    const { inputBoxDims, inputSoundHole, inputWood, inputLengthUnit, inputDensityUnit, inputName, inputSource, inputSourceDetail, validationErrors } = get();

    const hasMaterialMissing = inputWood.density === 0 || inputWood.elasticModulus === 0;
    if (validationErrors.length > 0 || hasMaterialMissing) {
      const id = uid();
      const params: ParameterSnapshot = {
        id: uid(),
        recordId: id,
        source: inputSource,
        sourceDetail: inputSourceDetail || (inputSource === 'import' ? '导入' : '手动输入'),
        boxDims: { ...inputBoxDims },
        soundHole: { ...inputSoundHole },
        wood: { ...inputWood },
        lengthUnit: inputLengthUnit,
        densityUnit: inputDensityUnit,
      };
      const record: ModalRecord = {
        id,
        name: inputName || `未命名记录 ${new Date().toLocaleDateString()}`,
        status: 'returned',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        parameters: params,
        peaks: [],
        auditLog: [
          {
            id: uid(),
            recordId: id,
            action: inputSource === 'import' ? 'import' : 'create',
            operator,
            reason: reason || '参数校验未通过，自动标记为需退回',
            timestamp: new Date().toISOString(),
            snapshot: params,
          },
        ],
      };
      get().addRecord(record);
      return record;
    }

    const id = uid();
    const params: ParameterSnapshot = {
      id: uid(),
      recordId: id,
      source: inputSource,
      sourceDetail: inputSourceDetail || (inputSource === 'import' ? '导入' : '手动输入'),
      boxDims: { ...inputBoxDims },
      soundHole: { ...inputSoundHole },
      wood: { ...inputWood },
      lengthUnit: inputLengthUnit,
      densityUnit: inputDensityUnit,
    };

    const peaks = calculateAllPeaks(inputBoxDims, inputSoundHole, inputWood, inputLengthUnit, inputDensityUnit, id);
    const hasOverlap = peaks.some((p) => p.isOverlapping);

    const record: ModalRecord = {
      id,
      name: inputName || `未命名记录 ${new Date().toLocaleDateString()}`,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      parameters: params,
      peaks,
      auditLog: [
        {
          id: uid(),
          recordId: id,
          action: inputSource === 'import' ? 'import' : 'create',
          operator,
          reason: reason || (hasOverlap ? '创建成功，检测到频率重叠' : '创建成功'),
          timestamp: new Date().toISOString(),
          snapshot: params,
        },
      ],
    };

    get().addRecord(record);
    get().resetInputs();
    return record;
  },

  changeStatus: (id, status, operator, reason) => {
    const record = get().records.find((r) => r.id === id);
    if (!record) return;

    const auditEntry: AuditEntry = {
      id: uid(),
      recordId: id,
      action: 'status_change',
      operator,
      reason: reason || `状态变更为: ${status === 'processed' ? '已处理' : status === 'pending' ? '待确认' : '需退回'}`,
      timestamp: new Date().toISOString(),
      snapshot: record.parameters,
    };

    get().updateRecord(id, {
      status,
      auditLog: [...record.auditLog, auditEntry],
    });
  },

  exportRecordById: (id) => {
    const record = get().records.find((r) => r.id === id);
    if (!record) return '';

    const auditEntry: AuditEntry = {
      id: uid(),
      recordId: id,
      action: 'export',
      operator: '当前用户',
      reason: '导出单条记录',
      timestamp: new Date().toISOString(),
      snapshot: record.parameters,
    };
    get().updateRecord(id, {
      auditLog: [...record.auditLog, auditEntry],
    });

    return exportRecord(record);
  },

  exportSelected: () => {
    const { records, selectedRecordIds } = get();
    const selected = records.filter((r) => selectedRecordIds.includes(r.id));
    const exportData = {
      version: '1.0',
      exportTime: new Date().toISOString(),
      records: selected.map((r) => ({
        id: r.id,
        name: r.name,
        status: r.status,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        parameters: r.parameters,
        peaks: r.peaks,
        auditLog: r.auditLog,
      })),
    };

    selected.forEach((r) => {
      const auditEntry: AuditEntry = {
        id: uid(),
        recordId: r.id,
        action: 'export',
        operator: '当前用户',
        reason: '批量导出',
        timestamp: new Date().toISOString(),
        snapshot: r.parameters,
      };
      get().updateRecord(r.id, {
        auditLog: [...r.auditLog, auditEntry],
      });
    });

    return JSON.stringify(exportData, null, 2);
  },

  importData: (text, format) => {
    const { records, results } = importAndValidate(text, format);
    let success = 0;
    let failed = 0;
    const allErrors: string[][] = [];

    records.forEach((r, idx) => {
      const result = results[idx];
      allErrors.push(result.errors);

      if (result.valid) {
        const id = r.id || uid();
        const params = r.parameters!;
        const peaks = calculateAllPeaks(params.boxDims, params.soundHole, params.wood, params.lengthUnit, params.densityUnit, id);
        const hasOverlap = peaks.some((p) => p.isOverlapping);

        const record: ModalRecord = {
          id,
          name: r.name || `导入记录 ${success + 1}`,
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          parameters: { ...params, id: uid(), recordId: id, source: 'import', sourceDetail: params.sourceDetail || `${format.toUpperCase()}导入` },
          peaks,
          auditLog: [
            {
              id: uid(),
              recordId: id,
              action: 'import',
              operator: '系统',
              reason: hasOverlap ? `导入成功，检测到频率重叠` : '导入成功',
              timestamp: new Date().toISOString(),
              snapshot: params,
            },
          ],
        };
        get().addRecord(record);
        success++;
      } else {
        const id = r.id || uid();
        const params = r.parameters || ({} as ParameterSnapshot);

        const record: ModalRecord = {
          id,
          name: r.name || `导入记录(异常) ${failed + 1}`,
          status: 'returned',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          parameters: { ...params, id: uid(), recordId: id, source: 'import', sourceDetail: params.sourceDetail || `${format.toUpperCase()}导入(异常)` },
          peaks: r.peaks || [],
          auditLog: [
            {
              id: uid(),
              recordId: id,
              action: 'import',
              operator: '系统',
              reason: `导入失败: ${result.errors.join('; ')}`,
              timestamp: new Date().toISOString(),
              snapshot: params,
            },
          ],
        };
        get().addRecord(record);
        failed++;
      }
    });

    return { success, failed, errors: allErrors };
  },

  loadSampleData: () => {
    const existing = get().records;
    const sampleIds = new Set(SAMPLE_PROBLEM_RECORDS.map((s) => s.id));
    const filtered = existing.filter((r) => !sampleIds.has(r.id));
    const merged = [...filtered, ...(SAMPLE_PROBLEM_RECORDS as ModalRecord[])];
    set({ records: merged });
    saveRecords(merged);
  },

  resetInputs: () => {
    set({
      inputBoxDims: { ...defaultBoxDims },
      inputSoundHole: { ...defaultSoundHole },
      inputWood: { ...defaultWood },
      inputLengthUnit: 'mm',
      inputDensityUnit: 'kg_m3',
      inputName: '',
      inputSource: 'manual',
      inputSourceDetail: '',
      validationErrors: [],
    });
  },

  editRecord: (id, params, operator, reason) => {
    const record = get().records.find((r) => r.id === id);
    if (!record) return;

    const peaks = calculateAllPeaks(params.boxDims, params.soundHole, params.wood, params.lengthUnit, params.densityUnit, id);
    const hasOverlap = peaks.some((p) => p.isOverlapping);

    const auditEntry: AuditEntry = {
      id: uid(),
      recordId: id,
      action: 'update',
      operator,
      reason: reason || (hasOverlap ? '编辑参数，检测到频率重叠' : '编辑参数'),
      timestamp: new Date().toISOString(),
      snapshot: params,
    };

    get().updateRecord(id, {
      parameters: params,
      peaks,
      status: 'pending',
      auditLog: [...record.auditLog, auditEntry],
    });
  },
}));
