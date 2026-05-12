import { useState, useCallback } from 'react';
import {
  Patient,
  Exam,
  FilmPickup,
  PrintRecord,
  ReprintRequest,
  AbnormalRecord,
  HistoryEntry,
  Statistics
} from '../types';
import {
  mockPatients,
  mockExams,
  mockFilmPickups,
  mockPrintRecords,
  mockReprintRequests,
  mockAbnormalRecords,
  mockHistory,
  mockPrinters
} from '../data/mockData';

interface StoreState {
  patients: Patient[];
  exams: Exam[];
  filmPickups: FilmPickup[];
  printRecords: PrintRecord[];
  reprintRequests: ReprintRequest[];
  abnormalRecords: AbnormalRecord[];
  history: HistoryEntry[];
  currentPage: 'home' | 'pickup' | 'reprint' | 'admin' | 'history' | 'statistics';
  selectedPatient: Patient | null;
  selectedExam: Exam | null;
  selectedPickup: FilmPickup | null;
  notification: { type: 'success' | 'error' | 'warning' | 'info'; message: string } | null;
}

const generateId = (prefix: string) => `${prefix}${Date.now().toString().slice(-6)}`;

export const useStore = () => {
  const [state, setState] = useState<StoreState>({
    patients: mockPatients,
    exams: mockExams,
    filmPickups: mockFilmPickups,
    printRecords: mockPrintRecords,
    reprintRequests: mockReprintRequests,
    abnormalRecords: mockAbnormalRecords,
    history: mockHistory,
    currentPage: 'home',
    selectedPatient: null,
    selectedExam: null,
    selectedPickup: null,
    notification: null
  });

  const navigate = useCallback((page: StoreState['currentPage']) => {
    setState(prev => ({ ...prev, currentPage: page }));
  }, []);

  const showNotification = useCallback((type: 'success' | 'error' | 'warning' | 'info', message: string) => {
    setState(prev => ({ ...prev, notification: { type, message } }));
    setTimeout(() => {
      setState(prev => ({ ...prev, notification: null }));
    }, 3000);
  }, []);

  const addHistory = useCallback((entry: Omit<HistoryEntry, 'id' | 'timestamp'>) => {
    const newEntry: HistoryEntry = {
      ...entry,
      id: generateId('H'),
      timestamp: new Date().toISOString()
    };
    setState(prev => ({ ...prev, history: [newEntry, ...prev.history] }));
  }, []);

  const addAbnormalRecord = useCallback((record: Omit<AbnormalRecord, 'id' | 'occurredAt' | 'status'>) => {
    const newRecord: AbnormalRecord = {
      ...record,
      id: generateId('AB'),
      occurredAt: new Date().toISOString(),
      status: 'pending'
    };
    setState(prev => ({ ...prev, abnormalRecords: [newRecord, ...prev.abnormalRecords] }));
    
    addHistory({
      type: 'abnormal',
      targetId: newRecord.id,
      action: '记录异常',
      details: { type: record.type, description: record.description }
    });
    
    return newRecord;
  }, [addHistory]);

  const validatePickupCode = useCallback((code: string) => {
    const pattern = /^\d{8}-\d{4}$/;
    return pattern.test(code);
  }, []);

  const findPatientByIdCard = useCallback((idCard: string) => {
    return state.patients.find(p => p.idCard === idCard) || null;
  }, [state.patients]);

  const findExamByExamNo = useCallback((examNo: string) => {
    return state.exams.find(e => e.examNo === examNo) || null;
  }, [state.exams]);

  const findPickupByCode = useCallback((code: string) => {
    return state.filmPickups.find(p => p.pickupCode === code) || null;
  }, [state.filmPickups]);

  const setSelectedPatient = useCallback((patient: Patient | null) => {
    setState(prev => ({ ...prev, selectedPatient: patient }));
  }, []);

  const setSelectedExam = useCallback((exam: Exam | null) => {
    setState(prev => ({ ...prev, selectedExam: exam }));
  }, []);

  const setSelectedPickup = useCallback((pickup: FilmPickup | null) => {
    setState(prev => ({ ...prev, selectedPickup: pickup }));
  }, []);

  const getPatientExams = useCallback((patientId: string) => {
    return state.exams.filter(e => e.patientId === patientId);
  }, [state.exams]);

  const getPatientPickups = useCallback((patientId: string) => {
    return state.filmPickups.filter(p => p.patientId === patientId);
  }, [state.filmPickups]);

  const verifyPickupCode = useCallback((code: string, patientId?: string, examNo?: string) => {
    if (!validatePickupCode(code)) {
      addAbnormalRecord({
        examNo: examNo || '',
        pickupCode: code,
        patientId: patientId || '',
        patientName: '',
        type: 'code_invalid',
        description: '取片码格式错误，应为8位数字+短横线+4位数字格式'
      });
      return { success: false, message: '取片码格式错误，请检查后重新输入' };
    }

    const pickup = findPickupByCode(code);
    if (!pickup) {
      addAbnormalRecord({
        examNo: examNo || '',
        pickupCode: code,
        patientId: patientId || '',
        patientName: '',
        type: 'code_invalid',
        description: '取片码不存在，请确认取片码是否正确'
      });
      return { success: false, message: '取片码不存在，请确认取片码是否正确' };
    }

    if (patientId && pickup.patientId !== patientId) {
      addAbnormalRecord({
        examNo: pickup.examNo,
        pickupCode: code,
        patientId: patientId,
        patientName: state.patients.find(p => p.id === patientId)?.name || '',
        type: 'mismatch',
        description: '患者信息与取片码不匹配'
      });
      return { success: false, message: '患者信息与取片码不匹配，请确认身份信息' };
    }

    if (examNo && pickup.examNo !== examNo) {
      addAbnormalRecord({
        examNo: examNo,
        pickupCode: code,
        patientId: pickup.patientId,
        patientName: pickup.patientName,
        type: 'mismatch',
        description: '检查号与取片码不匹配'
      });
      return { success: false, message: '检查号与取片码不匹配，请确认检查号' };
    }

    const now = new Date();
    const expiresAt = new Date(pickup.expiresAt);
    if (now > expiresAt) {
      addAbnormalRecord({
        examNo: pickup.examNo,
        pickupCode: code,
        patientId: pickup.patientId,
        patientName: pickup.patientName,
        type: 'code_expired',
        description: '取片码已过期'
      });
      return { success: false, message: '取片码已过期，请联系工作人员重新生成' };
    }

    if (pickup.status === 'used') {
      addAbnormalRecord({
        examNo: pickup.examNo,
        pickupCode: code,
        patientId: pickup.patientId,
        patientName: pickup.patientName,
        type: 'code_used',
        description: '取片码已使用过'
      });
      return { success: false, message: '取片码已使用过，如需补打请申请补打' };
    }

    return { success: true, pickup };
  }, [validatePickupCode, findPickupByCode, addAbnormalRecord, state.patients]);

  const printFilm = useCallback((pickupId: string) => {
    const pickup = state.filmPickups.find(p => p.id === pickupId);
    const exam = state.exams.find(e => e.examNo === pickup?.examNo);
    
    if (!pickup || !exam) {
      showNotification('error', '取片信息或检查信息不存在');
      return { success: false };
    }

    if (exam.status === 'pending') {
      showNotification('warning', '胶片尚未准备好，请稍后再来');
      return { success: false };
    }

    const availablePrinter = mockPrinters.find(p => p.status === 'ready');
    if (!availablePrinter) {
      addAbnormalRecord({
        examNo: pickup.examNo,
        pickupCode: pickup.pickupCode,
        patientId: pickup.patientId,
        patientName: pickup.patientName,
        type: 'printer_error',
        description: '没有可用的打印机'
      });
      showNotification('error', '打印机故障，请联系工作人员');
      return { success: false };
    }

    const printRecord: PrintRecord = {
      id: generateId('PR'),
      examNo: pickup.examNo,
      pickupCode: pickup.pickupCode,
      patientId: pickup.patientId,
      patientName: pickup.patientName,
      printType: 'original',
      printedAt: new Date().toISOString(),
      filmCount: exam.filmCount,
      operatorName: '自助终端',
      status: 'success',
      printerId: availablePrinter.id,
      printerName: availablePrinter.name
    };

    setState(prev => ({
      ...prev,
      printRecords: [printRecord, ...prev.printRecords],
      filmPickups: prev.filmPickups.map(p => 
        p.id === pickupId ? { ...p, status: 'used' as const } : p
      ),
      exams: prev.exams.map(e => 
        e.examNo === pickup.examNo ? { ...e, status: 'printed' as const } : e
      )
    }));

    addHistory({
      type: 'print',
      targetId: printRecord.id,
      action: '胶片打印成功',
      details: { examNo: pickup.examNo, patientName: pickup.patientName, filmCount: exam.filmCount, printer: availablePrinter.name }
    });

    showNotification('success', `打印成功！共 ${exam.filmCount} 张胶片，请在取片口取片`);
    return { success: true, printRecord };
  }, [state.filmPickups, state.exams, showNotification, addAbnormalRecord, addHistory]);

  const requestReprint = useCallback((data: { examNo: string; patientId: string; pickupCode: string; reason: string; applicantName: string }) => {
    const exam = findExamByExamNo(data.examNo);
    if (!exam) {
      showNotification('error', '检查信息不存在');
      return { success: false };
    }

    const existingRequest = state.reprintRequests.find(
      r => r.examNo === data.examNo && r.status === 'pending'
    );
    if (existingRequest) {
      showNotification('warning', '该检查已有待审核的补打申请');
      return { success: false };
    }

    const request: ReprintRequest = {
      id: generateId('RR'),
      examNo: data.examNo,
      patientId: data.patientId,
      patientName: state.patients.find(p => p.id === data.patientId)?.name || '',
      pickupCode: data.pickupCode,
      reason: data.reason,
      applicantName: data.applicantName,
      applicantId: data.patientId,
      appliedAt: new Date().toISOString(),
      status: 'pending'
    };

    setState(prev => ({
      ...prev,
      reprintRequests: [request, ...prev.reprintRequests]
    }));

    addHistory({
      type: 'reprint_request',
      targetId: request.id,
      action: '提交补打申请',
      details: { examNo: data.examNo, patientName: request.patientName, reason: data.reason }
    });

    showNotification('success', '补打申请已提交，请等待审核');
    return { success: true, request };
  }, [findExamByExamNo, state.reprintRequests, state.patients, showNotification, addHistory]);

  const reviewReprintRequest = useCallback((requestId: string, action: 'approve' | 'reject', comment?: string) => {
    const request = state.reprintRequests.find(r => r.id === requestId);
    if (!request) {
      showNotification('error', '补打申请不存在');
      return { success: false };
    }

    if (request.status !== 'pending') {
      showNotification('warning', '该申请已审核');
      return { success: false };
    }

    const exam = state.exams.find(e => e.examNo === request.examNo);
    if (!exam) {
      showNotification('error', '检查信息不存在');
      return { success: false };
    }

    if (action === 'approve') {
      const availablePrinter = mockPrinters.find(p => p.status === 'ready');
      if (!availablePrinter) {
        showNotification('error', '没有可用的打印机');
        return { success: false };
      }

      const printRecord: PrintRecord = {
        id: generateId('PR'),
        examNo: request.examNo,
        pickupCode: request.pickupCode,
        patientId: request.patientId,
        patientName: request.patientName,
        printType: 'reprint',
        printedAt: new Date().toISOString(),
        filmCount: exam.filmCount,
        operatorName: '审核员',
        status: 'success',
        printerId: availablePrinter.id,
        printerName: availablePrinter.name
      };

      setState(prev => ({
        ...prev,
        reprintRequests: prev.reprintRequests.map(r => 
          r.id === requestId ? { 
            ...r, 
            status: 'approved' as const,
            reviewedBy: '系统管理员',
            reviewedAt: new Date().toISOString(),
            reviewComment: comment
          } : r
        ),
        printRecords: [printRecord, ...prev.printRecords],
        exams: prev.exams.map(e => 
          e.examNo === request.examNo ? { ...e, status: 'reprinted' as const } : e
        )
      }));

      addHistory({
        type: 'reprint_review',
        targetId: requestId,
        action: '批准补打申请',
        details: { examNo: request.examNo, patientName: request.patientName, comment }
      });

      showNotification('success', '补打申请已批准，胶片正在打印');
    } else {
      setState(prev => ({
        ...prev,
        reprintRequests: prev.reprintRequests.map(r => 
          r.id === requestId ? { 
            ...r, 
            status: 'rejected' as const,
            reviewedBy: '系统管理员',
            reviewedAt: new Date().toISOString(),
            reviewComment: comment
          } : r
        )
      }));

      addHistory({
        type: 'reprint_review',
        targetId: requestId,
        action: '拒绝补打申请',
        details: { examNo: request.examNo, patientName: request.patientName, comment }
      });

      showNotification('warning', '补打申请已拒绝');
    }

    return { success: true };
  }, [state.reprintRequests, state.exams, showNotification, addHistory]);

  const resolveAbnormalRecord = useCallback((recordId: string, resolution: string) => {
    setState(prev => ({
      ...prev,
      abnormalRecords: prev.abnormalRecords.map(r => 
        r.id === recordId ? {
          ...r,
          status: 'resolved' as const,
          resolvedBy: '系统管理员',
          resolvedAt: new Date().toISOString(),
          resolution
        } : r
      )
    }));

    addHistory({
      type: 'abnormal',
      targetId: recordId,
      action: '处理异常记录',
      details: { resolution }
    });

    showNotification('success', '异常记录已处理');
  }, [addHistory, showNotification]);

  const getStatistics = useCallback((): Statistics => {
    return {
      totalPickups: state.filmPickups.length,
      totalPrints: state.printRecords.length,
      reprintRequests: state.reprintRequests.length,
      approvedReprints: state.reprintRequests.filter(r => r.status === 'approved').length,
      rejectedReprints: state.reprintRequests.filter(r => r.status === 'rejected').length,
      pendingReprints: state.reprintRequests.filter(r => r.status === 'pending').length,
      abnormalRecords: state.abnormalRecords.length,
      resolvedAbnormals: state.abnormalRecords.filter(r => r.status === 'resolved').length
    };
  }, [state]);

  const exportData = useCallback((type: 'print' | 'reprint' | 'abnormal') => {
    let data: any[] = [];
    let filename = '';

    switch (type) {
      case 'print':
        data = state.printRecords;
        filename = `打印记录_${new Date().toISOString().split('T')[0]}.json`;
        break;
      case 'reprint':
        data = state.reprintRequests;
        filename = `补打申请_${new Date().toISOString().split('T')[0]}.json`;
        break;
      case 'abnormal':
        data = state.abnormalRecords;
        filename = `异常记录_${new Date().toISOString().split('T')[0]}.json`;
        break;
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    addHistory({
      type: 'export',
      targetId: type,
      action: '导出数据',
      details: { type, recordCount: data.length }
    });

    showNotification('success', `已导出 ${data.length} 条记录`);
  }, [state.printRecords, state.reprintRequests, state.abnormalRecords, addHistory, showNotification]);

  return {
    state,
    navigate,
    showNotification,
    validatePickupCode,
    findPatientByIdCard,
    findExamByExamNo,
    findPickupByCode,
    setSelectedPatient,
    setSelectedExam,
    setSelectedPickup,
    getPatientExams,
    getPatientPickups,
    verifyPickupCode,
    printFilm,
    requestReprint,
    reviewReprintRequest,
    resolveAbnormalRecord,
    getStatistics,
    exportData,
    mockPrinters
  };
};

export type StoreType = ReturnType<typeof useStore>;
