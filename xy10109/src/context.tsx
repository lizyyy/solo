import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Certificate, HistoryRecord, ImportResult, ReviewStatus, CertificateType } from './types';
import { 
  loadCertificates, 
  saveCertificates, 
  loadHistory, 
  addHistoryRecord, 
  generateId 
} from './store';
import { 
  validateCertificate, 
  calculateStatus, 
  findConflicts,
  parseJSON,
  parseCSV,
  normalizeImportData,
  convertToCSV
} from './utils';

interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

interface AppContextType {
  certificates: Certificate[];
  history: HistoryRecord[];
  toasts: ToastMessage[];
  
  addCertificate: (cert: Omit<Certificate, 'id' | 'status' | 'reviewStatus' | 'createdAt' | 'updatedAt'>) => string[];
  updateCertificate: (id: string, updates: Partial<Certificate>) => boolean;
  deleteCertificate: (id: string) => boolean;
  
  importFromFile: (file: File) => Promise<ImportResult>;
  exportToJSON: () => void;
  exportToCSV: () => void;
  
  reviewCertificate: (id: string, status: ReviewStatus, comments?: string) => boolean;
  
  refreshStatuses: () => void;
  
  showToast: (type: ToastMessage['type'], message: string) => void;
  dismissToast: (id: string) => void;
  
  getStatistics: () => {
    total: number;
    valid: number;
    expired: number;
    expiringSoon: number;
    notReviewed: number;
    byType: Record<CertificateType, number>;
  };
}

const AppContext = createContext<AppContextType | null>(null);

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
}

interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    setCertificates(loadCertificates());
    setHistory(loadHistory());
  }, []);

  const showToast = useCallback((type: ToastMessage['type'], message: string) => {
    const id = generateId();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addCertificate = useCallback((certData: Omit<Certificate, 'id' | 'status' | 'reviewStatus' | 'createdAt' | 'updatedAt'>): string[] => {
    const errors = validateCertificate(certData);
    if (errors.length > 0) {
      showToast('error', `添加失败：${errors[0]}`);
      return errors;
    }

    const existing = certificates.find(c => c.certificateNumber === certData.certificateNumber.trim());
    if (existing) {
      showToast('warning', `证照编号 ${certData.certificateNumber} 已存在，请使用更新功能`);
      return [`证照编号 ${certData.certificateNumber} 已存在`];
    }

    const now = new Date().toISOString();
    const newCert: Certificate = {
      ...certData,
      id: generateId(),
      certificateNumber: certData.certificateNumber.trim(),
      status: calculateStatus(certData.expiryDate),
      reviewStatus: 'not_reviewed',
      createdAt: now,
      updatedAt: now
    };

    const updated = [...certificates, newCert];
    setCertificates(updated);
    saveCertificates(updated);
    addHistoryRecord({
      certificateId: newCert.id,
      action: '添加证照',
      details: `添加了 ${certData.name}（${certData.certificateNumber}）`
    });
    showToast('success', '证照添加成功');
    return [];
  }, [certificates, showToast]);

  const updateCertificate = useCallback((id: string, updates: Partial<Certificate>): boolean => {
    const index = certificates.findIndex(c => c.id === id);
    if (index === -1) {
      showToast('error', '证照不存在');
      return false;
    }

    const existing = certificates[index];
    const merged = { ...existing, ...updates };
    const errors = validateCertificate(merged);
    
    if (errors.length > 0) {
      showToast('error', `更新失败：${errors[0]}`);
      return false;
    }

    const conflicts = findConflicts(existing, updates);
    if (conflicts.length > 0) {
      const conflictFields = conflicts.map(c => c.field).join('、');
      showToast('warning', `检测到字段变更：${conflictFields}`);
    }

    const updated = [...certificates];
    updated[index] = {
      ...merged,
      status: updates.expiryDate ? calculateStatus(updates.expiryDate) : merged.status,
      updatedAt: new Date().toISOString()
    };

    setCertificates(updated);
    saveCertificates(updated);
    addHistoryRecord({
      certificateId: id,
      action: '更新证照',
      details: `更新了 ${existing.name}`
    });
    showToast('success', '证照更新成功');
    return true;
  }, [certificates, showToast]);

  const deleteCertificate = useCallback((id: string): boolean => {
    const cert = certificates.find(c => c.id === id);
    if (!cert) {
      showToast('error', '证照不存在');
      return false;
    }

    const updated = certificates.filter(c => c.id !== id);
    setCertificates(updated);
    saveCertificates(updated);
    addHistoryRecord({
      certificateId: id,
      action: '删除证照',
      details: `删除了 ${cert.name}（${cert.certificateNumber}）`
    });
    showToast('success', '证照已删除');
    return true;
  }, [certificates, showToast]);

  const importFromFile = useCallback(async (file: File): Promise<ImportResult> => {
    const result: ImportResult = {
      success: 0,
      failed: 0,
      errors: [],
      duplicates: []
    };

    try {
      const text = await file.text();
      let data: any[];

      if (file.name.toLowerCase().endsWith('.json')) {
        data = parseJSON(text);
      } else if (file.name.toLowerCase().endsWith('.csv')) {
        data = parseCSV(text);
      } else {
        result.errors.push('不支持的文件格式，请使用 JSON 或 CSV 文件');
        return result;
      }

      if (data.length === 0) {
        result.errors.push('文件中没有可导入的数据');
        return result;
      }

      let currentCerts = [...certificates];
      const now = new Date().toISOString();

      for (let i = 0; i < data.length; i++) {
        try {
          const raw = normalizeImportData(data[i]);
          
          if (!raw.certificateNumber) {
            result.failed++;
            result.errors.push(`第 ${i + 1} 行：缺少证照编号`);
            continue;
          }

          const existingIndex = currentCerts.findIndex(
            c => c.certificateNumber === raw.certificateNumber!.trim()
          );

          if (existingIndex !== -1) {
            const existing = currentCerts[existingIndex];
            const conflicts = findConflicts(existing, raw);
            if (conflicts.length > 0) {
              result.duplicates.push(
                `${raw.certificateNumber}（字段冲突：${conflicts.map(c => c.field).join(', ')}）`
              );
            } else {
              result.duplicates.push(`${raw.certificateNumber}（数据相同，已跳过）`);
            }
            result.failed++;
            continue;
          }

          const certData = {
            certificateNumber: raw.certificateNumber!.trim(),
            type: raw.type as CertificateType || 'store_license',
            name: raw.name || '未命名证照',
            holder: raw.holder || '未填写',
            issueDate: raw.issueDate || '1970-01-01',
            expiryDate: raw.expiryDate || '1970-01-01'
          };

          const errors = validateCertificate(certData);
          if (errors.length > 0) {
            result.failed++;
            result.errors.push(`第 ${i + 1} 行 ${raw.certificateNumber}：${errors[0]}`);
            continue;
          }

          const newCert: Certificate = {
            ...certData,
            id: generateId(),
            status: calculateStatus(certData.expiryDate),
            reviewStatus: 'not_reviewed',
            createdAt: now,
            updatedAt: now
          };

          currentCerts.push(newCert);
          result.success++;
        } catch (e) {
          result.failed++;
          result.errors.push(`第 ${i + 1} 行：解析错误`);
        }
      }

      setCertificates(currentCerts);
      saveCertificates(currentCerts);
      addHistoryRecord({
        certificateId: 'system',
        action: '批量导入',
        details: `从 ${file.name} 导入：成功 ${result.success} 条，失败 ${result.failed} 条`
      });

      if (result.success > 0) {
        showToast('success', `导入成功：${result.success} 条`);
      }
      if (result.failed > 0) {
        showToast('warning', `导入完成，${result.failed} 条失败/重复`);
      }

      return result;
    } catch (e) {
      result.errors.push('文件读取失败：' + (e instanceof Error ? e.message : '未知错误'));
      showToast('error', '文件导入失败');
      return result;
    }
  }, [certificates, showToast]);

  const exportToJSON = useCallback(() => {
    const dataStr = JSON.stringify(certificates, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `证照清单_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    addHistoryRecord({
      certificateId: 'system',
      action: '导出数据',
      details: `导出了 ${certificates.length} 条证照数据（JSON）`
    });
    showToast('success', '数据已导出为 JSON');
  }, [certificates, showToast]);

  const exportToCSV = useCallback(() => {
    const csvContent = convertToCSV(certificates);
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `证照清单_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    addHistoryRecord({
      certificateId: 'system',
      action: '导出数据',
      details: `导出了 ${certificates.length} 条证照数据（CSV）`
    });
    showToast('success', '数据已导出为 CSV');
  }, [certificates, showToast]);

  const reviewCertificate = useCallback((id: string, status: ReviewStatus, comments?: string): boolean => {
    const index = certificates.findIndex(c => c.id === id);
    if (index === -1) {
      showToast('error', '证照不存在');
      return false;
    }

    const updated = [...certificates];
    updated[index] = {
      ...updated[index],
      reviewStatus: status,
      reviewComments: comments,
      updatedAt: new Date().toISOString()
    };

    setCertificates(updated);
    saveCertificates(updated);
    addHistoryRecord({
      certificateId: id,
      action: '复核证照',
      details: `证照 ${updated[index].name} 复核状态更新为：${
        status === 'approved' ? '已通过' : 
        status === 'rejected' ? '已驳回' : 
        status === 'under_review' ? '复核中' : '未复核'
      }`
    });
    showToast('success', '复核状态已更新');
    return true;
  }, [certificates, showToast]);

  const refreshStatuses = useCallback(() => {
    const updated = certificates.map(cert => ({
      ...cert,
      status: calculateStatus(cert.expiryDate),
      updatedAt: new Date().toISOString()
    }));
    
    const changedCount = updated.filter((cert, i) => cert.status !== certificates[i].status).length;
    
    setCertificates(updated);
    saveCertificates(updated);
    
    if (changedCount > 0) {
      showToast('info', `状态已刷新，${changedCount} 个证照状态有变化`);
      addHistoryRecord({
        certificateId: 'system',
        action: '刷新状态',
        details: `刷新了 ${certificates.length} 条证照的到期状态，${changedCount} 条有更新`
      });
    } else {
      showToast('info', '状态已刷新，无变化');
    }
  }, [certificates, showToast]);

  const getStatistics = useCallback(() => {
    const byType: Record<CertificateType, number> = {
      store_license: 0,
      health_certificate: 0,
      supplier_qualification: 0
    };

    let valid = 0, expired = 0, expiringSoon = 0, notReviewed = 0;

    for (const cert of certificates) {
      byType[cert.type]++;
      if (cert.status === 'valid') valid++;
      else if (cert.status === 'expired') expired++;
      else if (cert.status === 'expiring_soon') expiringSoon++;
      if (cert.reviewStatus === 'not_reviewed') notReviewed++;
    }

    return {
      total: certificates.length,
      valid,
      expired,
      expiringSoon,
      notReviewed,
      byType
    };
  }, [certificates]);

  const value: AppContextType = {
    certificates,
    history,
    toasts,
    addCertificate,
    updateCertificate,
    deleteCertificate,
    importFromFile,
    exportToJSON,
    exportToCSV,
    reviewCertificate,
    refreshStatuses,
    showToast,
    dismissToast,
    getStatistics
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}
