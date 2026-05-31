import { ref, computed } from 'vue';
import type { ShortageRecord, FilterOptions, VersionHistory, ChangeDetail, Attachment } from '../types';
import { sampleRecords, currentUser } from '../data/sampleData';
import { compareVersions, detectOldVersionAttachment, hasConclusionChanges } from '../utils/compare';

const records = ref<ShortageRecord[]>([...sampleRecords]);
const selectedRecordId = ref<string | null>(null);
const filters = ref<FilterOptions>({});

export function useShortageStore() {
  const filteredRecords = computed(() => {
    let result = [...records.value];
    
    if (filters.value.status?.length) {
      result = result.filter(r => filters.value.status!.includes(r.status));
    }
    if (filters.value.storeId) {
      result = result.filter(r => r.storeId.includes(filters.value.storeId!));
    }
    if (filters.value.period) {
      result = result.filter(r => r.accountingPeriod === filters.value.period);
    }
    if (filters.value.hasUnresolvedChanges) {
      result = result.filter(r => r.hasUnresolvedChanges);
    }
    
    return result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  });

  const selectedRecord = computed(() => {
    if (!selectedRecordId.value) return null;
    return records.value.find(r => r.id === selectedRecordId.value) || null;
  });

  const stats = computed(() => {
    const all = records.value;
    return {
      total: all.length,
      pending: all.filter(r => r.status === 'pending').length,
      investigating: all.filter(r => r.status === 'investigating').length,
      resolved: all.filter(r => r.status === 'resolved').length,
      disputed: all.filter(r => r.status === 'disputed').length,
      hasAlerts: all.filter(r => r.hasUnresolvedChanges || r.latestAlert).length
    };
  });

  function selectRecord(id: string | null) {
    selectedRecordId.value = id;
  }

  function setFilters(newFilters: FilterOptions) {
    filters.value = { ...filters.value, ...newFilters };
  }

  function updateRecord(
    recordId: string,
    updates: Partial<ShortageRecord>,
    changeReason: string
  ): { changes: ChangeDetail[]; hasAlert: boolean; alertMessage?: string } {
    const record = records.value.find(r => r.id === recordId);
    if (!record) return { changes: [], hasAlert: false };

    const changes = compareVersions(record, updates);
    if (changes.length === 0) return { changes: [], hasAlert: false };

    let alertMessage: string | undefined;
    let hasAlert = false;

    if (updates.attachments) {
      for (const newAtt of updates.attachments) {
        const detection = detectOldVersionAttachment(record.attachments, newAtt);
        if (detection.isOld) {
          hasAlert = true;
          alertMessage = detection.message;
          newAtt.note = detection.message;
        }
      }
    }

    const newVersion: VersionHistory = {
      id: `V${record.currentVersion + 1}`,
      version: record.currentVersion + 1,
      timestamp: new Date().toISOString(),
      modifiedBy: currentUser.name,
      changeReason,
      changes,
      snapshot: {
        amount: updates.amount ?? record.amount,
        status: updates.status ?? record.status,
        conclusion: updates.conclusion ?? record.conclusion,
        issueCategory: updates.issueCategory ?? record.issueCategory,
        attachments: updates.attachments ?? record.attachments
      }
    };

    Object.assign(record, updates);
    record.versionHistory.push(newVersion);
    record.currentVersion = newVersion.version;
    record.updatedAt = new Date().toISOString();
    
    if (hasAlert && alertMessage) {
      record.latestAlert = alertMessage;
      record.hasUnresolvedChanges = hasConclusionChanges(changes);
    } else {
      record.hasUnresolvedChanges = hasConclusionChanges(changes);
    }

    return { changes, hasAlert, alertMessage };
  }

  function createRecord(
    data: Omit<ShortageRecord, 'id' | 'versionHistory' | 'currentVersion' | 'createdAt' | 'updatedAt' | 'hasUnresolvedChanges' | 'latestAlert'>
  ): ShortageRecord {
    const now = new Date();
    const period = data.accountingPeriod;
    const count = records.value.filter(r => r.accountingPeriod === period).length + 1;
    const id = `STR-${period}-${String(count).padStart(3, '0')}`;

    const initialChanges: ChangeDetail[] = [
      { field: 'amount', oldValue: '', newValue: String(data.amount), changeType: 'conclusion_changed' },
      { field: 'status', oldValue: '', newValue: data.status, changeType: 'conclusion_changed' },
      { field: 'issueCategory', oldValue: '', newValue: data.issueCategory, changeType: 'conclusion_changed' }
    ];

    const newRecord: ShortageRecord = {
      ...data,
      id,
      versionHistory: [{
        id: 'V1',
        version: 1,
        timestamp: now.toISOString(),
        modifiedBy: currentUser.name,
        changeReason: '创建记录',
        changes: initialChanges,
        snapshot: {
          amount: data.amount,
          status: data.status,
          conclusion: data.conclusion,
          issueCategory: data.issueCategory,
          attachments: data.attachments
        }
      }],
      currentVersion: 1,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      hasUnresolvedChanges: data.status === 'pending' || data.status === 'disputed'
    };

    records.value.unshift(newRecord);
    return newRecord;
  }

  function addAttachment(
    recordId: string,
    attachment: Omit<Attachment, 'id' | 'uploadedAt' | 'uploadedBy'>,
    changeReason: string
  ) {
    const record = records.value.find(r => r.id === recordId);
    if (!record) return { hasAlert: false };

    const newAttachment: Attachment = {
      ...attachment,
      id: `ATT-${Date.now()}`,
      uploadedAt: new Date().toISOString(),
      uploadedBy: currentUser.name
    };

    const detection = detectOldVersionAttachment(record.attachments, newAttachment);
    
    const updatedAttachments = [
      ...record.attachments.filter(a => a.name !== newAttachment.name),
      newAttachment
    ];

    return updateRecord(
      recordId,
      { attachments: updatedAttachments },
      detection.isOld ? `${changeReason}（检测到版本问题）` : changeReason
    );
  }

  function resolveAlert(recordId: string) {
    const record = records.value.find(r => r.id === recordId);
    if (record) {
      record.hasUnresolvedChanges = false;
    }
  }

  return {
    records: filteredRecords,
    allRecords: records,
    selectedRecord,
    selectedRecordId,
    filters,
    stats,
    selectRecord,
    setFilters,
    updateRecord,
    createRecord,
    addAttachment,
    resolveAlert
  };
}
