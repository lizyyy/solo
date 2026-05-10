import React, { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { ParkingCase, CaseStatus, PaymentRecord, TimelineEvent, EvidenceAttachment } from '../types';
import { initialCases } from '../data/sampleData';
import { generateId } from '../utils/helpers';

interface AppContextType {
  cases: ParkingCase[];
  selectedCase: ParkingCase | null;
  setSelectedCase: (caseData: ParkingCase | null) => void;
  addCase: (caseData: Omit<ParkingCase, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateCase: (id: string, updates: Partial<ParkingCase>) => void;
  updateCaseStatus: (id: string, status: CaseStatus, operator: string, comment?: string) => void;
  addPayment: (caseId: string, payment: Omit<PaymentRecord, 'id'>) => void;
  addEvidence: (caseId: string, evidence: Omit<EvidenceAttachment, 'id'>) => void;
  reviewManualRelease: (caseId: string, releaseId: string, approved: boolean, reviewer: string, comment: string) => void;
  exportCase: (caseId: string, operator: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [cases, setCases] = useState<ParkingCase[]>(initialCases);
  const [selectedCase, setSelectedCase] = useState<ParkingCase | null>(null);

  const addCase = useCallback((caseData: Omit<ParkingCase, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const newCase: ParkingCase = {
      ...caseData,
      id: `CASE-${generateId()}`,
      createdAt: now,
      updatedAt: now,
    };
    setCases(prev => [...prev, newCase]);
  }, []);

  const updateCase = useCallback((id: string, updates: Partial<ParkingCase>) => {
    const now = new Date().toISOString();
    setCases(prev => prev.map(c => 
      c.id === id ? { ...c, ...updates, updatedAt: now } : c
    ));
    if (selectedCase?.id === id) {
      setSelectedCase(prev => prev ? { ...prev, ...updates, updatedAt: now } : null);
    }
  }, [selectedCase]);

  const updateCaseStatus = useCallback((id: string, status: CaseStatus, operator: string, comment?: string) => {
    const timelineEvent: TimelineEvent = {
      id: `TL-${generateId()}`,
      timestamp: new Date().toISOString(),
      type: 'review',
      description: comment || `状态变更为: ${status}`,
      operator,
    };

    setCases(prev => prev.map(c => {
      if (c.id === id) {
        const updatedTimeline = [...c.timeline, timelineEvent];
        return { ...c, status, timeline: updatedTimeline, updatedAt: new Date().toISOString() };
      }
      return c;
    }));

    if (selectedCase?.id === id) {
      setSelectedCase(prev => {
        if (!prev) return null;
        const updatedTimeline = [...prev.timeline, timelineEvent];
        return { ...prev, status, timeline: updatedTimeline, updatedAt: new Date().toISOString() };
      });
    }
  }, [selectedCase]);

  const addPayment = useCallback((caseId: string, payment: Omit<PaymentRecord, 'id'>) => {
    const newPayment: PaymentRecord = {
      ...payment,
      id: `PAY-${generateId()}`,
    };

    const timelineEvent: TimelineEvent = {
      id: `TL-${generateId()}`,
      timestamp: new Date().toISOString(),
      type: 'payment',
      description: `收到补缴金额 ¥${payment.amount.toFixed(2)}`,
      operator: payment.method,
    };

    setCases(prev => prev.map(c => {
      if (c.id === caseId) {
        const newPaidAmount = c.paidAmount + payment.amount;
        const newPaymentStatus = newPaidAmount >= c.feeAmount ? 'paid' : 'partial';
        const newStatus = newPaidAmount >= c.feeAmount ? 'payment_completed' : 'payment_pending';
        
        return {
          ...c,
          payments: [...c.payments, newPayment],
          paidAmount: newPaidAmount,
          paymentStatus: newPaymentStatus,
          status: newStatus,
          timeline: [...c.timeline, timelineEvent],
          updatedAt: new Date().toISOString(),
        };
      }
      return c;
    }));
  }, []);

  const addEvidence = useCallback((caseId: string, evidence: Omit<EvidenceAttachment, 'id'>) => {
    const newEvidence: EvidenceAttachment = {
      ...evidence,
      id: `EVID-${generateId()}`,
    };

    const timelineEvent: TimelineEvent = {
      id: `TL-${generateId()}`,
      timestamp: new Date().toISOString(),
      type: 'event',
      description: `添加证据: ${evidence.name}`,
      operator: '操作员',
    };

    setCases(prev => prev.map(c => {
      if (c.id === caseId) {
        return {
          ...c,
          evidences: [...c.evidences, newEvidence],
          timeline: [...c.timeline, timelineEvent],
          updatedAt: new Date().toISOString(),
        };
      }
      return c;
    }));
  }, []);

  const reviewManualRelease = useCallback((caseId: string, releaseId: string, approved: boolean, reviewer: string, comment: string) => {
    const timelineEvent: TimelineEvent = {
      id: `TL-${generateId()}`,
      timestamp: new Date().toISOString(),
      type: 'review',
      description: `${approved ? '通过' : '拒绝'}人工放行复核: ${comment}`,
      operator: reviewer,
    };

    setCases(prev => prev.map(c => {
      if (c.id === caseId) {
        const updatedReleases = c.manualReleases.map(r => 
          r.id === releaseId 
            ? { ...r, reviewed: true, reviewer, reviewComment: comment }
            : r
        );

        const allReviewed = updatedReleases.every(r => r.reviewed);
        const hasMissingEvidence = c.evidences.some(e => e.placeholder);
        
        let newStatus: CaseStatus = c.status;
        if (allReviewed && approved && !hasMissingEvidence) {
          newStatus = 'payment_pending';
        } else if (allReviewed && !approved) {
          newStatus = 'rejected';
        } else if (hasMissingEvidence) {
          newStatus = 'pending_review';
        }

        return {
          ...c,
          manualReleases: updatedReleases,
          status: newStatus,
          timeline: [...c.timeline, timelineEvent],
          updatedAt: new Date().toISOString(),
        };
      }
      return c;
    }));
  }, []);

  const exportCase = useCallback((caseId: string, operator: string) => {
    const timelineEvent: TimelineEvent = {
      id: `TL-${generateId()}`,
      timestamp: new Date().toISOString(),
      type: 'export',
      description: '案件已导出归档',
      operator,
    };

    setCases(prev => prev.map(c => {
      if (c.id === caseId) {
        return {
          ...c,
          status: 'exported',
          timeline: [...c.timeline, timelineEvent],
          updatedAt: new Date().toISOString(),
        };
      }
      return c;
    }));
  }, []);

  return (
    <AppContext.Provider value={{
      cases,
      selectedCase,
      setSelectedCase,
      addCase,
      updateCase,
      updateCaseStatus,
      addPayment,
      addEvidence,
      reviewManualRelease,
      exportCase,
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
