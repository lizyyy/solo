import { Router, Request, Response } from 'express';
import { ImportService } from '../services/ImportService';
import { ReconciliationService } from '../services/ReconciliationService';
import { ReviewService } from '../services/ReviewService';
import { ExportService } from '../services/ExportService';
import { DataStore } from '../store/DataStore';
import { ObjectLevel, AttendanceStatus, LeaveStatus, LeaveType, ReviewStatus } from '../types';

const router = Router();
const importService = new ImportService();
const reconciliationService = new ReconciliationService();
const reviewService = new ReviewService();
const exportService = new ExportService();
const store = DataStore.getInstance();

router.post('/import/sample-data', (req: Request, res: Response) => {
  const date = req.body.date || '2024-01-15';

  const persons = [
    { id: 'P001', name: '张三', idCard: '110101199001010001', level: ObjectLevel.LEVEL_A, department: '第一司法所', manager: '王主任' },
    { id: 'P002', name: '李四', idCard: '110101199002020002', level: ObjectLevel.LEVEL_A, department: '第一司法所', manager: '王主任' },
    { id: 'P003', name: '王五', idCard: '110101199003030003', level: ObjectLevel.LEVEL_B, department: '第二司法所', manager: '李主任' },
    { id: 'P004', name: '赵六', idCard: '110101199004040004', level: ObjectLevel.LEVEL_B, department: '第二司法所', manager: '李主任' },
    { id: 'P005', name: '钱七', idCard: '110101199005050005', level: ObjectLevel.LEVEL_C, department: '第三司法所', manager: '张主任' }
  ];

  persons.forEach(p => store.addPerson(p));

  const attendances = [
    { personId: 'P001', personName: '张三', date, signInTime: '09:05', signOutTime: '17:55', expectedSignInTime: '09:00', expectedSignOutTime: '18:00', status: AttendanceStatus.NORMAL, source: '签到系统' },
    { personId: 'P002', personName: '李四', date, signInTime: '10:15', signOutTime: '17:30', expectedSignInTime: '09:00', expectedSignOutTime: '18:00', status: AttendanceStatus.LATE, source: '签到系统' },
    { personId: 'P003', personName: '王五', date, signInTime: null, signOutTime: null, expectedSignInTime: '09:00', expectedSignOutTime: '18:00', status: AttendanceStatus.ABSENT, source: '签到系统' },
    { personId: 'P004', personName: '赵六', date, signInTime: '09:00', signOutTime: '12:00', expectedSignInTime: '09:00', expectedSignOutTime: '18:00', status: AttendanceStatus.EXCEPTION, source: '签到系统' },
    { personId: 'P005', personName: '钱七', date, signInTime: '08:55', signOutTime: '18:05', expectedSignInTime: '09:00', expectedSignOutTime: '18:00', status: AttendanceStatus.NORMAL, source: '签到系统' }
  ];

  attendances.forEach(a => {
    store.addAttendance({
      id: store.generateId(),
      ...a,
      createdAt: store.now(),
      updatedAt: store.now()
    } as any);
  });

  const leaves = [
    { personId: 'P004', personName: '赵六', leaveType: LeaveType.SICK, startDate: date, endDate: date, startTime: '12:00', endTime: '18:00', reason: '身体不适，去医院看病', status: LeaveStatus.APPROVED, approver: '李主任', approveTime: '2024-01-14 16:00', source: '请假系统' }
  ];

  leaves.forEach(l => {
    store.addLeave({
      id: store.generateId(),
      ...l,
      createdAt: store.now(),
      updatedAt: store.now()
    } as any);
  });

  const locationTraces = [
    {
      personId: 'P001', personName: '张三', date,
      tracePoints: [
        { timestamp: `${date} 08:30:00`, latitude: 39.9042, longitude: 116.4074, location: '司法所', isAnomaly: false },
        { timestamp: `${date} 10:00:00`, latitude: 39.9045, longitude: 116.4080, location: '司法所', isAnomaly: false },
        { timestamp: `${date} 12:00:00`, latitude: 39.9050, longitude: 116.4090, location: '附近餐厅', isAnomaly: false },
        { timestamp: `${date} 14:00:00`, latitude: 39.9045, longitude: 116.4080, location: '司法所', isAnomaly: false },
        { timestamp: `${date} 17:30:00`, latitude: 39.9100, longitude: 116.4150, location: '回家路上', isAnomaly: false }
      ],
      anomalyCount: 0, isComplete: true, source: '定位系统'
    },
    {
      personId: 'P002', personName: '李四', date,
      tracePoints: [
        { timestamp: `${date} 10:15:00`, latitude: 39.9200, longitude: 116.4200, location: '派出所', isAnomaly: false },
        { timestamp: `${date} 11:30:00`, latitude: 39.9210, longitude: 116.4220, location: '派出所', isAnomaly: false },
        { timestamp: `${date} 16:00:00`, latitude: 39.9500, longitude: 116.5000, location: '远离区域', isAnomaly: true, anomalyReason: '超出活动范围5公里' }
      ],
      anomalyCount: 1, isComplete: true, source: '定位系统'
    },
    {
      personId: 'P004', personName: '赵六', date,
      tracePoints: [
        { timestamp: `${date} 08:30:00`, latitude: 39.8800, longitude: 116.3500, location: '家', isAnomaly: false },
        { timestamp: `${date} 09:00:00`, latitude: 39.8850, longitude: 116.3600, location: '司法所', isAnomaly: false },
        { timestamp: `${date} 11:00:00`, latitude: 39.8900, longitude: 116.3700, location: '医院', isAnomaly: false }
      ],
      anomalyCount: 0, isComplete: true, source: '定位系统'
    },
    {
      personId: 'P005', personName: '钱七', date,
      tracePoints: [
        { timestamp: `${date} 08:45:00`, latitude: 39.8700, longitude: 116.3400, location: '司法所', isAnomaly: false },
        { timestamp: `${date} 14:00:00`, latitude: 39.8750, longitude: 116.3450, location: '司法所', isAnomaly: false }
      ],
      anomalyCount: 0, isComplete: false, source: '定位系统'
    }
  ];

  locationTraces.forEach(t => {
    store.addLocationTrace({
      id: store.generateId(),
      ...t,
      createdAt: store.now(),
      updatedAt: store.now()
    } as any);
  });

  res.json({
    success: true,
    message: '样例数据导入成功',
    data: { persons: 5, attendances: 5, leaves: 1, locationTraces: 4 }
  });
});

router.post('/reconcile', (req: Request, res: Response) => {
  const date = req.body.date || '2024-01-15';
  const result = reconciliationService.performReconciliation(date);

  res.json({
    success: true,
    message: '对账完成',
    data: {
      reconciliationId: result.reconciliationId,
      totalRecords: result.records.length,
      recordsWithDifferences: result.records.filter(r => r.differences.length > 0).length
    }
  });
});

router.get('/records/:reconciliationId', (req: Request, res: Response) => {
  const reconciliationId = req.params.reconciliationId;
  const records = reviewService.getReconciliationRecords(reconciliationId);

  res.json({
    success: true,
    data: records
  });
});

router.get('/records/:reconciliationId/summary', (req: Request, res: Response) => {
  const reconciliationId = req.params.reconciliationId;
  const summary = reviewService.getReviewSummary(reconciliationId);

  res.json({
    success: true,
    data: summary
  });
});

router.get('/records/:reconciliationId/with-differences', (req: Request, res: Response) => {
  const reconciliationId = req.params.reconciliationId;
  const records = reviewService.getRecordsWithDifferences(reconciliationId);

  res.json({
    success: true,
    count: records.length,
    data: records
  });
});

router.post('/review', (req: Request, res: Response) => {
  const request = req.body;
  const updatedRecords = reviewService.batchReview(request);

  res.json({
    success: true,
    message: `批量复核完成，共更新 ${updatedRecords.length} 条记录`,
    data: updatedRecords
  });
});

router.post('/correct', (req: Request, res: Response) => {
  const request = req.body;
  const updatedRecord = reviewService.applyManualCorrection(request);

  if (!updatedRecord) {
    return res.status(404).json({
      success: false,
      message: '记录不存在'
    });
  }

  res.json({
    success: true,
    message: '人工修正已应用',
    data: updatedRecord
  });
});

router.post('/recalculate/:reconciliationId', (req: Request, res: Response) => {
  const reconciliationId = req.params.reconciliationId;
  const updatedRecords = reconciliationService.recalculateReconciliation(reconciliationId);

  res.json({
    success: true,
    message: `重新计算完成，共更新 ${updatedRecords.length} 条记录`,
    data: updatedRecords
  });
});

router.get('/export/excel/:reconciliationId', async (req: Request, res: Response) => {
  try {
    const reconciliationId = req.params.reconciliationId;
    const filePath = await exportService.exportToExcel(reconciliationId);

    res.download(filePath, (err) => {
      if (err) {
        res.status(500).json({
          success: false,
          message: '文件下载失败',
          error: err.message
        });
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: '导出失败',
      error: error.message
    });
  }
});

router.get('/export/csv/:reconciliationId', async (req: Request, res: Response) => {
  try {
    const reconciliationId = req.params.reconciliationId;
    const filePath = await exportService.exportToCSV(reconciliationId);

    res.download(filePath, (err) => {
      if (err) {
        res.status(500).json({
          success: false,
          message: '文件下载失败',
          error: err.message
        });
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: '导出失败',
      error: error.message
    });
  }
});

router.get('/record/:recordId', (req: Request, res: Response) => {
  const recordId = req.params.recordId;
  const record = reviewService.getReviewRecord(recordId);

  if (!record) {
    return res.status(404).json({
      success: false,
      message: '记录不存在'
    });
  }

  res.json({
    success: true,
    data: record
  });
});

router.get('/reconciliation-ids', (req: Request, res: Response) => {
  const ids = store.getAllReconciliationIds();

  res.json({
    success: true,
    data: ids
  });
});

export default router;
