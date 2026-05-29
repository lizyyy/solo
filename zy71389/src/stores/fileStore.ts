import { create } from 'zustand';
import {
  FileRecord,
  FileType,
  ProcessStatus,
  UserBucket,
  ExposureLog,
  OperationChange,
  ConversionData,
  ExperimentConfig,
  LogEntry
} from '../types';
import { FileParserEngine, FileParseResult } from '../engines/FileParserEngine';

interface FileStore {
  files: FileRecord[];
  selectedDirectory: string | null;
  isScanning: boolean;
  scanProgress: number;
  logs: LogEntry[];
  parseLogs: LogEntry[];
  
  userBuckets: UserBucket[];
  exposureLogs: ExposureLog[];
  operationChanges: OperationChange[];
  conversionData: ConversionData[];
  experimentConfigs: ExperimentConfig[];
  fileObjects: Map<string, File>;
  
  addFile: (file: FileRecord) => void;
  updateFile: (id: string, updates: Partial<FileRecord>) => void;
  removeFile: (id: string) => void;
  clearAll: () => void;
  clearAllData: () => void;
  
  addLog: (log: LogEntry) => void;
  clearLogs: () => void;
  setParseLogs: (logs: LogEntry[]) => void;
  addParseLog: (log: LogEntry) => void;
  
  uploadFile: (file: File, type?: FileType) => Promise<void>;
  uploadDirectory: (files: File[]) => Promise<void>;
  
  setUserBuckets: (data: UserBucket[]) => void;
  setExposureLogs: (data: ExposureLog[]) => void;
  setOperationChanges: (data: OperationChange[]) => void;
  setConversionData: (data: ConversionData[]) => void;
  
  processFiles: () => Promise<void>;
  processFile: (file: File, record: FileRecord) => Promise<void>;
  
  getFilesByType: (type: FileType) => FileRecord[];
  getFileCounts: () => Record<FileType, number>;
  hasRequiredFiles: () => boolean;
}

export const useFileStore = create<FileStore>((set, get) => ({
  files: [],
  selectedDirectory: null,
  isScanning: false,
  scanProgress: 0,
  logs: [],
  parseLogs: [],
  
  userBuckets: [],
  exposureLogs: [],
  operationChanges: [],
  conversionData: [],
  experimentConfigs: [],
  fileObjects: new Map(),
  
  addFile: (file) => set((state) => ({
    files: [...state.files, file]
  })),
  
  updateFile: (id, updates) => set((state) => ({
    files: state.files.map(f => 
      f.id === id ? { ...f, ...updates } : f
    )
  })),
  
  removeFile: (id) => set((state) => ({
    files: state.files.filter(f => f.id !== id)
  })),
  
  clearAll: () => set({
    files: [],
    userBuckets: [],
    exposureLogs: [],
    operationChanges: [],
    conversionData: [],
    experimentConfigs: [],
    logs: [],
    parseLogs: [],
    scanProgress: 0,
    fileObjects: new Map()
  }),
  
  clearAllData: () => {
    get().clearAll();
  },
  
  addLog: (log) => set((state) => ({
    logs: [...state.logs, log].slice(-500)
  })),
  
  clearLogs: () => set({ logs: [] }),
  
  setParseLogs: (logs) => set({ parseLogs: logs }),
  
  addParseLog: (log) => set((state) => ({
    parseLogs: [...state.parseLogs, log].slice(-500)
  })),
  
  setUserBuckets: (data) => set({ userBuckets: data }),
  setExposureLogs: (data) => set({ exposureLogs: data }),
  setOperationChanges: (data) => set({ operationChanges: data }),
  setConversionData: (data) => set({ conversionData: data }),
  
  uploadFile: async (file, type) => {
    const { addFile, addParseLog, processFile, fileObjects } = get();
    const detectedType = type || FileParserEngine.detectFileType(file.name);
    const id = FileParserEngine.generateId();
    
    const record: FileRecord = {
      id,
      name: file.name,
      path: file.name,
      size: file.size,
      type: detectedType,
      status: ProcessStatus.PENDING,
      rowCount: 0,
      createdAt: Date.now()
    };
    
    addFile(record);
    set((state) => ({
      fileObjects: new Map(state.fileObjects).set(id, file)
    }));
    
    addParseLog(FileParserEngine.createLogEntry(
      'info',
      `文件已上传: ${file.name}`,
      `检测类型: ${detectedType}`
    ));
    
    await processFile(file, record);
  },
  
  uploadDirectory: async (files) => {
    const { uploadFile, addParseLog } = get();
    
    addParseLog(FileParserEngine.createLogEntry(
      'info',
      `开始处理目录, 共 ${files.length} 个文件`
    ));
    
    for (let i = 0; i < files.length; i++) {
      try {
        await uploadFile(files[i]);
      } catch (error) {
        addParseLog(FileParserEngine.createLogEntry(
          'error',
          `处理文件失败: ${files[i].name}`,
          error instanceof Error ? error.message : '未知错误'
        ));
      }
    }
    
    addParseLog(FileParserEngine.createLogEntry(
      'success',
      '目录处理完成'
    ));
  },
  
  processFile: async (file, record) => {
    const { addLog, updateFile } = get();
    
    updateFile(record.id, { status: ProcessStatus.PROCESSING, processedAt: Date.now() });
    
    addLog(FileParserEngine.createLogEntry(
      'info',
      `开始处理文件: ${file.name}`,
      `类型: ${record.type}`
    ));
    
    try {
      const result: FileParseResult<any> = await FileParserEngine.parseFileByType(
        file,
        record.type
      );
      
      if (!result.success && result.errors.length > 0) {
        const errorMsg = result.errors.slice(0, 3).map(e => 
          `行${e.row}: ${e.message}${e.field ? ` (${e.field})` : ''}`
        ).join('; ');
        
        addLog(FileParserEngine.createLogEntry(
          'warn',
          `文件 ${file.name} 解析存在问题`,
          errorMsg
        ));
      }
      
      if (result.data.length === 0 && result.errors.length > 0) {
        throw new Error(`解析失败: ${result.errors[0].message}`);
      }
      
      set((state) => {
        let newState: Partial<FileStore> = {};
        
        switch (record.type) {
          case FileType.USER_BUCKET:
            newState.userBuckets = FileParserEngine.mergeDeduplicate(
              state.userBuckets,
              result.data,
              'userId'
            );
            break;
          case FileType.EXPOSURE_LOG:
            newState.exposureLogs = FileParserEngine.mergeDeduplicate(
              state.exposureLogs,
              result.data,
              'exposureId'
            );
            break;
          case FileType.OPERATION_CHANGE:
            newState.operationChanges = FileParserEngine.mergeDeduplicate(
              state.operationChanges,
              result.data,
              'changeId'
            );
            break;
          case FileType.CONVERSION_DATA:
            newState.conversionData = FileParserEngine.mergeDeduplicate(
              state.conversionData,
              result.data,
              'conversionId'
            );
            break;
          case FileType.EXPERIMENT_CONFIG:
            newState.experimentConfigs = FileParserEngine.mergeDeduplicate(
              state.experimentConfigs,
              result.data,
              'experimentId'
            );
            break;
        }
        
        return newState;
      });
      
      updateFile(record.id, {
        status: ProcessStatus.COMPLETED,
        rowCount: result.data.length,
        processedAt: Date.now()
      });
      
      addLog(FileParserEngine.createLogEntry(
        'success',
        `文件 ${file.name} 处理完成`,
        `成功解析 ${result.data.length} 条记录`
      ));
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      
      updateFile(record.id, {
        status: ProcessStatus.ERROR,
        errorMessage,
        processedAt: Date.now()
      });
      
      addLog(FileParserEngine.createLogEntry(
        'error',
        `文件 ${file.name} 处理失败`,
        errorMessage
      ));
    }
  },
  
  processFiles: async () => {
    const { files, processFile, addLog, updateFile, fileObjects } = get();
    
    const pendingFiles = files.filter(f => 
      f.status === ProcessStatus.PENDING || 
      f.status === ProcessStatus.ERROR
    );
    
    if (pendingFiles.length === 0) {
      addLog(FileParserEngine.createLogEntry(
        'warn',
        '没有待处理的文件'
      ));
      return;
    }
    
    set({ isScanning: true, scanProgress: 0 });
    
    addLog(FileParserEngine.createLogEntry(
      'info',
      `开始批量处理 ${pendingFiles.length} 个文件`
    ));
    
    for (let i = 0; i < pendingFiles.length; i++) {
      const record = pendingFiles[i];
      const file = fileObjects.get(record.id);
      
      if (file) {
        await processFile(file, record);
      } else {
        updateFile(record.id, {
          status: ProcessStatus.SKIPPED,
          errorMessage: '文件对象不存在，请重新上传'
        });
        addLog(FileParserEngine.createLogEntry(
          'warn',
          `跳过文件 ${record.name}`,
          '文件对象不存在'
        ));
      }
      
      set({ scanProgress: ((i + 1) / pendingFiles.length) * 100 });
    }
    
    set({ isScanning: false, scanProgress: 100 });
    
    const { getFileCounts } = get();
    const counts = getFileCounts();
    
    addLog(FileParserEngine.createLogEntry(
      'success',
      '批量处理完成',
      `用户分桶: ${counts[FileType.USER_BUCKET]}, ` +
      `曝光日志: ${counts[FileType.EXPOSURE_LOG]}, ` +
      `运营变更: ${counts[FileType.OPERATION_CHANGE]}, ` +
      `转化数据: ${counts[FileType.CONVERSION_DATA]}`
    ));
  },
  
  getFilesByType: (type) => {
    return get().files.filter(f => f.type === type);
  },
  
  getFileCounts: () => {
    const { userBuckets, exposureLogs, operationChanges, conversionData, experimentConfigs } = get();
    return {
      [FileType.EXPERIMENT_CONFIG]: experimentConfigs.length,
      [FileType.USER_BUCKET]: userBuckets.length,
      [FileType.EXPOSURE_LOG]: exposureLogs.length,
      [FileType.OPERATION_CHANGE]: operationChanges.length,
      [FileType.CONVERSION_DATA]: conversionData.length,
      [FileType.CONTAMINATION_REPORT]: 0,
      [FileType.UNKNOWN]: 0
    };
  },
  
  hasRequiredFiles: () => {
    const { userBuckets, exposureLogs, conversionData } = get();
    return userBuckets.length > 0 && exposureLogs.length > 0 && conversionData.length > 0;
  }
}));
