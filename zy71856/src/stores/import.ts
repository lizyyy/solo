import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { ImportPackage, RawRecord, ImportItem, ProcessResult } from '@/types/import';
import { DEFAULT_IMPORT_CONFIG, RECORD_TYPE_LABELS } from '@/types/import';
import type { TimelineEvent, AbnormalMark, EvidenceLink } from '@/types/timeline';
import type { GateSession, GateStudentOperation } from '@/types/gate';
import { generateId } from '@/utils/time';
import { deduplicateRecords, classifyRecordType, detectLateArrival } from '@/utils/deduplicate';
import { savePackage, getAllPackages } from '@/utils/storage';
import { generateMockPackage } from '@/mock/samplePackage';
import { useTimelineStore } from './timeline';
import { useGateStore } from './gate';

export const useImportStore = defineStore('import', () => {
  const packages = ref<ImportPackage[]>([]);
  const currentPackageId = ref<string | null>(null);
  const isProcessing = ref(false);
  const isLoading = ref(false);

  const currentPackage = computed(() => {
    if (!currentPackageId.value) return null;
    return packages.value.find(p => p.id === currentPackageId.value) || null;
  });

  const processingPackages = computed(() => {
    return packages.value.filter(p => p.status === 'processing');
  });

  const completedPackages = computed(() => {
    return packages.value.filter(p => p.status === 'done');
  });

  async function loadPackages() {
    isLoading.value = true;
    try {
      packages.value = await getAllPackages();
    } catch (error) {
      console.error('Failed to load packages:', error);
    } finally {
      isLoading.value = false;
    }
  }

  function createPackage(name: string, records: RawRecord[]): ImportPackage {
    const items: ImportItem[] = records.map(record => ({
      id: generateId(),
      packageId: '',
      type: classifyRecordType(record),
      originalData: record,
      warnings: []
    }));

    const pkg: ImportPackage = {
      id: generateId(),
      name,
      uploadTime: Date.now(),
      status: 'processing',
      totalItems: items.length,
      items: items.map(item => ({ ...item, packageId: '' })),
      stats: { normal: 0, late: 0, duplicate: 0, corrected: 0, errors: 0 },
      progress: 0
    };

    items.forEach(item => {
      item.packageId = pkg.id;
    });
    pkg.items = items;

    packages.value.push(pkg);
    currentPackageId.value = pkg.id;
    return pkg;
  }

  async function processPackage(pkgId: string): Promise<ProcessResult> {
    isProcessing.value = true;
    const pkg = packages.value.find(p => p.id === pkgId);
    if (!pkg) {
      isProcessing.value = false;
      throw new Error('Package not found');
    }

    try {
      pkg.status = 'processing';
      pkg.progress = 10;

      const records: RawRecord[] = pkg.items.map(item => item.originalData);
      const dedupResults = deduplicateRecords(records, DEFAULT_IMPORT_CONFIG);

      pkg.progress = 40;

      const stats = { normal: 0, late: 0, duplicate: 0, corrected: 0, errors: 0 };
      const eventIds: string[] = [];
      const abnormalIds: string[] = [];
      const warnings: string[] = [];

      const timelineStore = useTimelineStore();
      const eventsToAdd: Omit<TimelineEvent, 'id' | 'version' | 'lastModified' | 'evidenceLinks'> & { evidenceLinks?: EvidenceLink[] }[] = [];

      let mainEventTime: number | undefined;

      for (const result of dedupResults) {
        const record = result.kept;
        const recordType = classifyRecordType(record);

        if (!mainEventTime && recordType === 'normal') {
          mainEventTime = record.timestamp;
        }

        stats[recordType]++;

        const item = pkg.items.find(i => i.originalData.id === record.id);
        if (item) {
          item.type = recordType;
          if (result.duplicates.length > 0) {
            item.warnings = item.warnings || [];
            item.warnings.push(result.reason);
            warnings.push(result.reason);
          }
        }

        let eventType: TimelineEvent['type'] = 'operation';
        let eventStatus: TimelineEvent['status'] = 'normal';
        let abnormalMark: AbnormalMark | undefined;
        const evidenceLinks: EvidenceLink[] = [];

        if (recordType === 'corrected') {
          eventType = 'manual';
          evidenceLinks.push({
            id: generateId(),
            eventId: '',
            type: 'manual',
            url: '',
            description: '人工更正记录',
            timestamp: record.timestamp,
            metadata: record.metadata
          });
        } else if (recordType === 'late' || detectLateArrival(record, mainEventTime)) {
          eventType = 'abnormal';
          eventStatus = 'pending';
          abnormalMark = {
            id: generateId(),
            eventId: '',
            type: 'late_arrival',
            description: '附件到达时间晚于操作时间',
            confirmed: false,
            originalEvidence: record
          };
          stats.late++;
          abnormalIds.push('');
        } else if (result.duplicates.length > 0) {
          eventType = 'abnormal';
          eventStatus = 'pending';
          abnormalMark = {
            id: generateId(),
            eventId: '',
            type: 'duplicate',
            description: `检测到${result.duplicates.length}条重复记录，已保留本条`,
            confirmed: false,
            originalEvidence: { duplicates: result.duplicates }
          };
          abnormalIds.push('');
        }

        const eventData = {
          timestamp: record.timestamp,
          type: eventType,
          title: record.title,
          description: record.description || RECORD_TYPE_LABELS[recordType],
          status: eventStatus,
          source: 'import' as const,
          operator: record.operator,
          abnormalMark,
          evidenceLinks,
          metadata: {
            ...record.metadata,
            importPackageId: pkgId,
            recordId: record.id,
            recordType
          }
        };

        eventsToAdd.push(eventData);

        result.duplicates.forEach(dup => {
          stats.duplicate++;
          const dupItem = pkg.items.find(i => i.originalData.id === dup.id);
          if (dupItem) {
            dupItem.type = 'duplicate';
            dupItem.warnings = dupItem.warnings || [];
            dupItem.warnings.push(`已作为重复项合并到记录: ${record.title}`);
          }
        });
      }

      pkg.progress = 70;

      const addedEvents = await timelineStore.addEvents(eventsToAdd);
      addedEvents.forEach((event, index) => {
        eventIds.push(event.id);
        const item = pkg.items.find(i => i.originalData.id === eventsToAdd[index].metadata?.recordId);
        if (item) {
          item.processedEventId = event.id;
        }
        if (event.abnormalMark) {
          event.abnormalMark.eventId = event.id;
          timelineStore.updateEvent(event.id, { abnormalMark: event.abnormalMark });
        }
        event.evidenceLinks.forEach(link => {
          link.eventId = event.id;
        });
        if (event.evidenceLinks.length > 0) {
          timelineStore.updateEvent(event.id, { evidenceLinks: event.evidenceLinks });
        }
      });

      pkg.progress = 90;

      pkg.stats = stats;
      pkg.status = 'done';
      pkg.progress = 100;

      await savePackage(pkg);

      const timelineStore = useTimelineStore();
      const allEvents = await timelineStore.getBySession?.(pkg.id) || await timelineStore.getAll();

      const { session, events } = buildSessionAndEvents(pkg, allEvents.filter(e => eventIds.includes(e.id)));

      const gateStore = useGateStore();
      await gateStore.persistSession(session);

      isProcessing.value = false;

      return {
        package: pkg,
        eventIds,
        abnormalIds: abnormalIds.filter(Boolean),
        warnings,
        session,
        events
      };
    } catch (error) {
      pkg.status = 'error';
      pkg.errorMessage = error instanceof Error ? error.message : '处理失败';
      pkg.stats.errors = pkg.totalItems;
      isProcessing.value = false;
      throw error;
    }
  }

  function selectPackage(id: string | null) {
    currentPackageId.value = id;
  }

  function parseJSONFile(file: File): Promise<RawRecord[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const data = JSON.parse(content);
          if (Array.isArray(data)) {
            resolve(data);
          } else if (data.records && Array.isArray(data.records)) {
            resolve(data.records);
          } else {
            reject(new Error('文件格式不正确，需要包含记录数组'));
          }
        } catch (err) {
          reject(new Error('JSON解析失败: ' + (err as Error).message));
        }
      };
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsText(file);
    });
  }

  async function importFile(file: File) {
    isProcessing.value = true;
    try {
      const records = await parseJSONFile(file);
      const pkg = createPackage(file.name, records);
      await savePackage(pkg);
      isProcessing.value = false;
      return pkg;
    } catch (error) {
      isProcessing.value = false;
      throw error;
    }
  }

  async function loadDemoData() {
    isProcessing.value = true;
    try {
      const mockData = generateMockPackage();
      const pkg = createPackage('演示数据包（水利闸门操作）', mockData.records);
      await savePackage(pkg);
      isProcessing.value = false;
      return pkg;
    } catch (error) {
      isProcessing.value = false;
      throw error;
    }
  }

  function buildSessionAndEvents(pkg: ImportPackage, events: TimelineEvent[]): { session: GateSession; events: TimelineEvent[] } {
    const gateStore = useGateStore();

    const startTime = Math.min(...pkg.items.map(i => i.originalData.timestamp));
    const endTime = Math.max(...pkg.items.map(i => i.originalData.timestamp));

    const session: GateSession = {
      id: generateId(),
      studentName: pkg.items.find(i => i.originalData.operator)?.originalData.operator || '演示学员',
      startTime,
      endTime,
      totalScore: 0,
      maxScore: 60,
      abnormalCount: 0,
      steps: gateStore.createNewSession().steps.map(step => {
        const matchingOp = pkg.items.find(item => {
          const op = item.originalData;
          return op.metadata?.stepId === step.step.id;
        });

        if (matchingOp) {
          const opData = matchingOp.originalData;
          const operation: GateStudentOperation = {
            id: generateId(),
            stepId: step.step.id,
            timestamp: opData.timestamp,
            duration: opData.metadata?.duration || 5,
            parameters: opData.metadata?.parameters || {}
          };
          return { ...step, operation, status: 'completed' as const };
        }
        return step;
      })
    };

    const passCount = session.steps.filter(s => s.status === 'completed').length;
    const abnormalCount = pkg.items.filter(i => i.type === 'late' || i.type === 'duplicate').length;
    session.abnormalCount = abnormalCount;
    session.totalScore = passCount * 10;

    events.forEach(event => {
      event.sessionId = session.id;
    });

    return { session, events };
  }

  return {
    packages,
    currentPackageId,
    currentPackage,
    processingPackages,
    completedPackages,
    isProcessing,
    isLoading,
    loadPackages,
    createPackage,
    processPackage,
    selectPackage,
    parseJSONFile,
    importFile,
    loadDemoData
  };
});
