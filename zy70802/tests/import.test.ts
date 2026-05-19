import { ImportService } from '../src/services/ImportService';
import { DataStore } from '../src/store/DataStore';

describe('ImportService', () => {
  let importService: ImportService;
  let dataStore: DataStore;

  beforeEach(() => {
    dataStore = DataStore.getInstance();
    dataStore.clearAll();
    importService = new ImportService();
  });

  it('should import callbacks from JSON string', async () => {
    const jsonString = JSON.stringify([
      {
        patientId: 'P001',
        patientName: '张三',
        calledAt: '2024-01-15 02:35:00',
        calledBy: '李检验',
        calledTo: '13800138001',
        doctorName: '张医生',
        confirmedAt: '2024-01-15 02:36:00',
        confirmationNotes: '已收到',
        callResult: 'connected',
      },
    ]);

    const result = await importService.importCallbacksFromJSONString(jsonString);

    expect(result.success).toBe(true);
    expect(result.importedCount).toBe(1);
    expect(dataStore.getAllCallbacks().length).toBe(1);
  });
});
