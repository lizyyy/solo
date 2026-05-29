import { create } from 'zustand';
import type {
  InventoryRecord,
  ConditionHistory,
  PriceHistory,
  Exception,
  AlbumGroup,
  RecordFormData,
  RecordStatus,
  ConditionGrade,
  ExceptionType,
  FilterCriteria,
} from '@/types';
import {
  saveToStorage,
  loadFromStorage,
  generateId,
} from '@/utils/storage';
import {
  normalizeCatalogNumber,
  isDuplicateCatalogNumber,
  findDuplicateRecord,
  findAlbumMatches,
  findOrCreateAlbumGroup,
  generateVersionTagForGroup,
} from '@/utils/catalogMatcher';
import {
  validateTransition,
  getMissingFields,
  canSubmitToPending,
  getInitialStatus,
  isModifiable,
  canTransition,
} from '@/utils/stateMachine';

interface RecordStore {
  records: InventoryRecord[];
  conditionHistories: ConditionHistory[];
  priceHistories: PriceHistory[];
  exceptions: Exception[];
  albumGroups: AlbumGroup[];
  filters: FilterCriteria;

  persistAll: () => void;

  addRecord: (data: Partial<RecordFormData>) => {
    success: boolean;
    record?: InventoryRecord;
    errors?: string[];
  };
  updateRecord: (
    id: string,
    updates: Partial<RecordFormData>,
    reason?: string
  ) => { success: boolean; record?: InventoryRecord; errors?: string[] };
  updateRecordStatus: (
    id: string,
    newStatus: RecordStatus,
    reason: string
  ) => { success: boolean; errors?: string[] };
  updateCondition: (
    id: string,
    newCondition: ConditionGrade,
    reason: string
  ) => { success: boolean; errors?: string[] };
  updatePrice: (
    id: string,
    newPrice: number,
    reason: string
  ) => { success: boolean; errors?: string[] };
  deleteRecord: (id: string) => boolean;

  getRecordById: (id: string) => InventoryRecord | undefined;
  getConditionHistory: (recordId: string) => ConditionHistory[];
  getPriceHistory: (recordId: string) => PriceHistory[];
  getRecordExceptions: (recordId: string) => Exception[];
  getAlbumGroupRecords: (albumGroupId: string) => InventoryRecord[];
  getFilteredRecords: () => InventoryRecord[];
  getUnresolvedExceptions: () => Exception[];

  resolveException: (exceptionId: string) => void;
  setFilters: (filters: Partial<FilterCriteria>) => void;
  resetFilters: () => void;

  checkDuplicate: (catalogNumber: string, excludeId?: string) => boolean;
  getDuplicateRecord: (
    catalogNumber: string,
    excludeId?: string
  ) => InventoryRecord | undefined;

  loadFromStorage: () => void;
  clearAllData: () => void;
}

const DEFAULT_FILTERS: FilterCriteria = {
  searchText: '',
  status: [],
  condition: [],
  consignor: '',
  minPrice: null,
  maxPrice: null,
  albumGroupId: null,
  hasExceptions: null,
};

function createException(
  recordId: string,
  type: ExceptionType,
  message: string,
  field?: string
): Exception {
  return {
    id: generateId(),
    recordId,
    type,
    field,
    message,
    resolved: false,
    timestamp: new Date().toISOString(),
  };
}

function createConditionHistory(
  recordId: string,
  fromCondition: ConditionGrade,
  toCondition: ConditionGrade,
  reason: string
): ConditionHistory {
  return {
    id: generateId(),
    recordId,
    fromCondition,
    toCondition,
    reason,
    operator: '管理员',
    timestamp: new Date().toISOString(),
  };
}

function createPriceHistory(
  recordId: string,
  fromPrice: number,
  toPrice: number,
  reason: string
): PriceHistory {
  return {
    id: generateId(),
    recordId,
    fromPrice,
    toPrice,
    reason,
    operator: '管理员',
    timestamp: new Date().toISOString(),
  };
}

function persistAll(state: {
  records: InventoryRecord[];
  conditionHistories: ConditionHistory[];
  priceHistories: PriceHistory[];
  exceptions: Exception[];
  albumGroups: AlbumGroup[];
}): void {
  saveToStorage('records', state.records);
  saveToStorage('conditionHistories', state.conditionHistories);
  saveToStorage('priceHistories', state.priceHistories);
  saveToStorage('exceptions', state.exceptions);
  saveToStorage('albumGroups', state.albumGroups);
}

export const useRecordStore = create<RecordStore>((set, get) => ({
  records: [],
  conditionHistories: [],
  priceHistories: [],
  exceptions: [],
  albumGroups: [],
  filters: DEFAULT_FILTERS,

  persistAll: () => {
    const state = get();
    persistAll(state);
  },

  addRecord: (data) => {
    const state = get();
    const errors: string[] = [];

    const missingFields = getMissingFields(data);
    if (missingFields.length > 0) {
      errors.push(
        `缺少必填字段: ${missingFields.join(', ')}`
      );
    }

    if (data.catalogNumber) {
      if (isDuplicateCatalogNumber(data.catalogNumber, state.records)) {
        errors.push(`版号 "${data.catalogNumber}" 已存在，禁止重复录入`);
      }
    }

    if (!data.catalogNumber || !data.albumName || !data.artist) {
      const baseMissing: string[] = [];
      if (!data.catalogNumber) baseMissing.push('版号');
      if (!data.albumName) baseMissing.push('专辑名');
      if (!data.artist) baseMissing.push('艺人');
    }

    if (errors.length > 0 && missingFields.length === 0) {
      return { success: false, errors };
    }

    const status = getInitialStatus(data);
    const now = new Date().toISOString();

    let albumGroupId = '';
    let versionTag = '';
    const newAlbumGroups = [...state.albumGroups];

    if (data.albumName && data.artist && data.catalogNumber) {
      const albumMatches = findAlbumMatches(
        data.albumName,
        data.catalogNumber,
        state.records
      );
      const group = findOrCreateAlbumGroup(
        data.albumName,
        data.artist,
        newAlbumGroups,
        albumMatches,
        generateId
      );

      if (!newAlbumGroups.find((g) => g.id === group.id)) {
        newAlbumGroups.push(group);
      }

      const groupIndex = newAlbumGroups.findIndex((g) => g.id === group.id);
      if (groupIndex >= 0) {
        newAlbumGroups[groupIndex] = {
          ...newAlbumGroups[groupIndex],
        };
        albumGroupId = group.id;
        versionTag = generateVersionTagForGroup(
          data.catalogNumber,
          group.recordIds.length
        );
        newAlbumGroups[groupIndex].recordIds.push('temp');
      }
    }

    const newRecord: InventoryRecord = {
      id: generateId(),
      catalogNumber: data.catalogNumber || '',
      albumName: data.albumName || '',
      artist: data.artist || '',
      pressYear: data.pressYear || '',
      condition: data.condition || 'VG',
      consignor: data.consignor || '',
      price: data.price || 0,
      shelfLocation: data.shelfLocation || '',
      verificationReport: data.verificationReport || '',
      status,
      versionTag,
      albumGroupId,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    const newExceptions: Exception[] = [...state.exceptions];
    if (missingFields.length > 0) {
      missingFields.forEach((field) => {
        newExceptions.push(
          createException(
            newRecord.id,
            'missing_field',
            `字段"${field}"缺失`,
            field
          )
        );
      });
    }

    if (data.price !== undefined && data.price !== null) {
      if (data.price <= 0) {
        newExceptions.push(
          createException(
            newRecord.id,
            'price_anomaly',
            `价格异常: ${data.price}`,
            'price'
          )
        );
      }
    }

    const groupIdx = newAlbumGroups.findIndex((g) => g.id === albumGroupId);
    if (groupIdx >= 0) {
      newAlbumGroups[groupIdx].recordIds = [
        ...newAlbumGroups[groupIdx].recordIds.filter((id) => id !== 'temp'),
        newRecord.id,
      ];
    }

    set((state) => ({
      records: [...state.records, newRecord],
      exceptions: newExceptions,
      albumGroups: newAlbumGroups,
    }));

    persistAll(get());

    return { success: true, record: newRecord, errors: errors.length > 0 ? errors : undefined };
  },

  updateRecord: (id, updates, reason = '修正记录') => {
    const state = get();
    const record = state.records.find((r) => r.id === id);
    const errors: string[] = [];

    if (!record) {
      return { success: false, errors: ['记录不存在'] };
    }

    if (!isModifiable(record.status)) {
      return {
        success: false,
        errors: [`状态为"${record.status}"的记录不可修改`],
      };
    }

    if (updates.catalogNumber && updates.catalogNumber !== record.catalogNumber) {
      if (isDuplicateCatalogNumber(updates.catalogNumber, state.records, id)) {
        errors.push(`版号 "${updates.catalogNumber}" 已存在`);
        return { success: false, errors };
      }
    }

    const updatedData = { ...record, ...updates };
    const missingFields = getMissingFields(updatedData);

    let newStatus = record.status;
    if (record.status === 'draft' && missingFields.length === 0) {
      newStatus = 'pending';
    } else if (record.status !== 'draft' && missingFields.length > 0) {
      newStatus = 'draft';
    }

    const now = new Date().toISOString();
    const updatedRecord: InventoryRecord = {
      ...record,
      ...updates,
      status: newStatus,
      version: record.version + 1,
      updatedAt: now,
    };

    const newConditionHistories = [...state.conditionHistories];
    const newPriceHistories = [...state.priceHistories];

    if (updates.condition && updates.condition !== record.condition) {
      newConditionHistories.push(
        createConditionHistory(
          id,
          record.condition,
          updates.condition,
          reason
        )
      );
    }

    if (
      updates.price !== undefined &&
      updates.price !== null &&
      updates.price !== record.price
    ) {
      newPriceHistories.push(
        createPriceHistory(id, record.price, updates.price, reason)
      );
    }

    const newExceptions = state.exceptions.filter(
      (e) => e.recordId !== id || e.resolved
    );
    if (missingFields.length > 0) {
      missingFields.forEach((field) => {
        const existing = state.exceptions.find(
          (e) =>
            e.recordId === id &&
            e.type === 'missing_field' &&
            e.field === field &&
            !e.resolved
        );
        if (!existing) {
          newExceptions.push(
            createException(id, 'missing_field', `字段"${field}"缺失`, field)
          );
        } else {
          newExceptions.push(existing);
        }
      });
    }

    set((state) => ({
      records: state.records.map((r) => (r.id === id ? updatedRecord : r)),
      conditionHistories: newConditionHistories,
      priceHistories: newPriceHistories,
      exceptions: newExceptions,
    }));

    persistAll(get());

    return { success: true, record: updatedRecord };
  },

  updateRecordStatus: (id, newStatus, reason) => {
    const state = get();
    const record = state.records.find((r) => r.id === id);

    if (!record) {
      return { success: false, errors: ['记录不存在'] };
    }

    const validation = validateTransition(record.status, newStatus);
    if (!validation.valid) {
      return { success: false, errors: [validation.message || '状态变更不合法'] };
    }

    if (newStatus === 'pending' || newStatus === 'verified') {
      const missingFields = getMissingFields(record);
      if (missingFields.length > 0) {
        return {
          success: false,
          errors: [`字段不完整，无法提交: ${missingFields.join(', ')}`],
        };
      }
    }

    const now = new Date().toISOString();
    const updatedRecord: InventoryRecord = {
      ...record,
      status: newStatus,
      version: record.version + 1,
      updatedAt: now,
    };

    const newExceptions = [...state.exceptions];
    if (newStatus === 'verified') {
      const unresolved = state.exceptions.filter(
        (e) => e.recordId === id && !e.resolved
      );
      unresolved.forEach((e) => {
        newExceptions.push({ ...e, resolved: true });
      });
    }

    set((state) => ({
      records: state.records.map((r) => (r.id === id ? updatedRecord : r)),
      exceptions: newExceptions,
    }));

    persistAll(get());

    return { success: true };
  },

  updateCondition: (id, newCondition, reason) => {
    const state = get();
    const record = state.records.find((r) => r.id === id);

    if (!record) {
      return { success: false, errors: ['记录不存在'] };
    }

    if (!isModifiable(record.status)) {
      return {
        success: false,
        errors: [`状态为"${record.status}"的记录不可修改`],
      };
    }

    const history = createConditionHistory(
      id,
      record.condition,
      newCondition,
      reason
    );

    const updatedRecord: InventoryRecord = {
      ...record,
      condition: newCondition,
      version: record.version + 1,
      updatedAt: new Date().toISOString(),
    };

    set((state) => ({
      records: state.records.map((r) => (r.id === id ? updatedRecord : r)),
      conditionHistories: [...state.conditionHistories, history],
    }));

    persistAll(get());

    return { success: true };
  },

  updatePrice: (id, newPrice, reason) => {
    const state = get();
    const record = state.records.find((r) => r.id === id);

    if (!record) {
      return { success: false, errors: ['记录不存在'] };
    }

    if (!isModifiable(record.status)) {
      return {
        success: false,
        errors: [`状态为"${record.status}"的记录不可修改`],
      };
    }

    if (newPrice <= 0) {
      return { success: false, errors: ['价格必须大于0'] };
    }

    const history = createPriceHistory(id, record.price, newPrice, reason);

    const updatedRecord: InventoryRecord = {
      ...record,
      price: newPrice,
      version: record.version + 1,
      updatedAt: new Date().toISOString(),
    };

    const newExceptions = [...state.exceptions];
    const existingPriceException = state.exceptions.find(
      (e) =>
        e.recordId === id &&
        e.type === 'price_anomaly' &&
        e.field === 'price' &&
        !e.resolved
    );
    if (existingPriceException) {
      const idx = newExceptions.indexOf(existingPriceException);
      if (idx >= 0) {
        newExceptions[idx] = { ...existingPriceException, resolved: true };
      }
    }

    set((state) => ({
      records: state.records.map((r) => (r.id === id ? updatedRecord : r)),
      priceHistories: [...state.priceHistories, history],
      exceptions: newExceptions,
    }));

    persistAll(get());

    return { success: true };
  },

  deleteRecord: (id) => {
    const state = get();
    const record = state.records.find((r) => r.id === id);

    if (!record) return false;

    const updatedAlbumGroups = state.albumGroups.map((g) => ({
      ...g,
      recordIds: g.recordIds.filter((rid) => rid !== id),
    }));

    set((state) => ({
      records: state.records.filter((r) => r.id !== id),
      conditionHistories: state.conditionHistories.filter((h) => h.recordId !== id),
      priceHistories: state.priceHistories.filter((h) => h.recordId !== id),
      exceptions: state.exceptions.filter((e) => e.recordId !== id),
      albumGroups: updatedAlbumGroups,
    }));

    persistAll(get());

    return true;
  },

  getRecordById: (id) => {
    return get().records.find((r) => r.id === id);
  },

  getConditionHistory: (recordId) => {
    return get()
      .conditionHistories.filter((h) => h.recordId === recordId)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  },

  getPriceHistory: (recordId) => {
    return get()
      .priceHistories.filter((h) => h.recordId === recordId)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  },

  getRecordExceptions: (recordId) => {
    return get().exceptions.filter((e) => e.recordId === recordId);
  },

  getAlbumGroupRecords: (albumGroupId) => {
    return get().records.filter((r) => r.albumGroupId === albumGroupId);
  },

  getFilteredRecords: () => {
    const state = get();
    const { filters, records, exceptions } = state;

    return records.filter((r) => {
      if (filters.searchText) {
        const search = filters.searchText.toLowerCase();
        const matchText =
          r.catalogNumber.toLowerCase().includes(search) ||
          r.albumName.toLowerCase().includes(search) ||
          r.artist.toLowerCase().includes(search) ||
          r.consignor.toLowerCase().includes(search) ||
          r.shelfLocation.toLowerCase().includes(search);
        if (!matchText) return false;
      }

      if (filters.status.length > 0 && !filters.status.includes(r.status)) {
        return false;
      }

      if (filters.condition.length > 0 && !filters.condition.includes(r.condition)) {
        return false;
      }

      if (filters.consignor && r.consignor !== filters.consignor) {
        return false;
      }

      if (filters.minPrice !== null && r.price < filters.minPrice) {
        return false;
      }

      if (filters.maxPrice !== null && r.price > filters.maxPrice) {
        return false;
      }

      if (filters.albumGroupId && r.albumGroupId !== filters.albumGroupId) {
        return false;
      }

      if (filters.hasExceptions !== null) {
        const hasUnresolved = exceptions.some(
          (e) => e.recordId === r.id && !e.resolved
        );
        if (filters.hasExceptions !== hasUnresolved) {
          return false;
        }
      }

      return true;
    });
  },

  getUnresolvedExceptions: () => {
    return get().exceptions.filter((e) => !e.resolved);
  },

  resolveException: (exceptionId) => {
    set((state) => ({
      exceptions: state.exceptions.map((e) =>
        e.id === exceptionId ? { ...e, resolved: true } : e
      ),
    }));
    persistAll(get());
  },

  setFilters: (newFilters) => {
    set((state) => ({
      filters: { ...state.filters, ...newFilters },
    }));
  },

  resetFilters: () => {
    set({ filters: DEFAULT_FILTERS });
  },

  checkDuplicate: (catalogNumber, excludeId) => {
    return isDuplicateCatalogNumber(catalogNumber, get().records, excludeId);
  },

  getDuplicateRecord: (catalogNumber, excludeId) => {
    return findDuplicateRecord(catalogNumber, get().records, excludeId);
  },

  loadFromStorage: () => {
    const records = loadFromStorage<InventoryRecord[]>('records', []);
    const conditionHistories = loadFromStorage<ConditionHistory[]>(
      'conditionHistories',
      []
    );
    const priceHistories = loadFromStorage<PriceHistory[]>('priceHistories', []);
    const exceptions = loadFromStorage<Exception[]>('exceptions', []);
    const albumGroups = loadFromStorage<AlbumGroup[]>('albumGroups', []);

    set({
      records,
      conditionHistories,
      priceHistories,
      exceptions,
      albumGroups,
    });
  },

  clearAllData: () => {
    set({
      records: [],
      conditionHistories: [],
      priceHistories: [],
      exceptions: [],
      albumGroups: [],
      filters: DEFAULT_FILTERS,
    });
    localStorage.clear();
  },
}));
