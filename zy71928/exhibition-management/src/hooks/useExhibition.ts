import { useState, useCallback } from 'react';
import {
  Exhibition,
  User,
  FlashLoanRequest,
  LightingRecord,
  LoanItem,
  DimensionUnit,
} from '@/types';
import { mockExhibition, mockUsers, mockFlashLoans } from '@/data/mockData';
import { validateAndConvertUnit } from '@/utils/unitValidation';
import { createNoteVersion, createLightingRecordVersion } from '@/utils/versionControl';
import {
  createFlashLoanRequest,
  manuallyOverrideJudgment,
  generateLayoutList,
} from '@/utils/flashLoanJudgment';

export function useExhibition() {
  const [currentUser, setCurrentUser] = useState<User>(mockUsers[0]);
  const [exhibition, setExhibition] = useState<Exhibition>({
    ...mockExhibition,
    flashLoans: mockFlashLoans,
  });
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [selectedFlashLoan, setSelectedFlashLoan] = useState<string | null>(null);

  const switchUser = useCallback((userId: string) => {
    const user = mockUsers.find(u => u.id === userId);
    if (user) setCurrentUser(user);
  }, []);

  const confirmAnomaly = useCallback((anomalyId: string) => {
    setExhibition(prev => ({
      ...prev,
      anomalies: prev.anomalies.map(a =>
        a.id === anomalyId
          ? {
              ...a,
              confirmed: true,
              confirmedBy: currentUser.id,
              confirmedAt: new Date().toISOString(),
            }
          : a
      ),
      updatedAt: new Date().toISOString(),
    }));

    setExhibition(prev => ({
      ...prev,
      changeLogs: prev.changeLogs.map(cl =>
        cl.entityId === anomalyId ||
        prev.anomalies.find(a => a.id === anomalyId)?.entityId === cl.entityId
          ? { ...cl, confirmed: true, confirmedBy: currentUser.id, confirmedAt: new Date().toISOString() }
          : cl
      ),
    }));

    const anomaly = exhibition.anomalies.find(a => a.id === anomalyId);
    if (anomaly && anomaly.type === 'dimension_unit_error') {
      setExhibition(prev => ({
        ...prev,
        artworks: prev.artworks.map(aw =>
          aw.id === anomaly.entityId ? { ...aw, unitConfirmed: true, status: 'normal' } : aw
        ),
      }));
    }
  }, [currentUser, exhibition.anomalies]);

  const updateArtworkUnit = useCallback((artworkId: string, newUnit: DimensionUnit) => {
    const artwork = exhibition.artworks.find(a => a.id === artworkId);
    if (!artwork) return;

    const result = validateAndConvertUnit(artwork, newUnit, currentUser);
    
    setExhibition(prev => ({
      ...prev,
      artworks: prev.artworks.map(a => (a.id === artworkId ? result.artwork : a)),
      changeLogs: [...prev.changeLogs, result.changeLog],
      anomalies: result.anomaly
        ? [...prev.anomalies, result.anomaly]
        : prev.anomalies,
      updatedAt: new Date().toISOString(),
    }));
  }, [exhibition.artworks, currentUser]);

  const addCuratorNote = useCallback((content: string, isSupplement: boolean, supplementReason?: string) => {
    const latestNote = exhibition.curatorNotes[exhibition.curatorNotes.length - 1];
    const result = createNoteVersion(
      exhibition.id,
      content,
      currentUser,
      latestNote,
      isSupplement,
      supplementReason
    );

    setExhibition(prev => ({
      ...prev,
      curatorNotes: [...prev.curatorNotes, result.note],
      changeLogs: [...prev.changeLogs, result.changeLog],
      anomalies: result.anomaly
        ? [...prev.anomalies, result.anomaly]
        : prev.anomalies,
      updatedAt: new Date().toISOString(),
    }));
  }, [exhibition.id, exhibition.curatorNotes, currentUser]);

  const updateLightingRecord = useCallback(
    (
      artworkId: string,
      lightingData: Partial<LightingRecord>,
      isOverride: boolean,
      overrideReason?: string
    ) => {
      const existingRecord = exhibition.lightingRecords.find(
        r => r.artworkId === artworkId
      );

      const result = createLightingRecordVersion(
        exhibition.id,
        artworkId,
        lightingData,
        currentUser,
        isOverride,
        overrideReason,
        existingRecord
      );

      setExhibition(prev => ({
        ...prev,
        lightingRecords: existingRecord
          ? prev.lightingRecords.map(r => (r.id === existingRecord.id ? result.record : r))
          : [...prev.lightingRecords, result.record],
        changeLogs: [...prev.changeLogs, result.changeLog],
        anomalies: result.anomaly
          ? [...prev.anomalies, result.anomaly]
          : prev.anomalies,
        updatedAt: new Date().toISOString(),
      }));
    },
    [exhibition.id, exhibition.lightingRecords, currentUser]
  );

  const submitFlashLoanRequest = useCallback(
    (title: string, description: string, changes: LoanItem[]) => {
      const latestLoan = exhibition.flashLoans[exhibition.flashLoans.length - 1];
      const newRequest = createFlashLoanRequest(
        exhibition.id,
        title,
        description,
        changes,
        currentUser,
        exhibition,
        latestLoan
      );

      setExhibition(prev => ({
        ...prev,
        flashLoans: [...prev.flashLoans, newRequest],
        updatedAt: new Date().toISOString(),
      }));

      return newRequest;
    },
    [exhibition, currentUser]
  );

  const overrideFlashLoanJudgment = useCallback(
    (loanId: string, newStatus: FlashLoanRequest['status'], reason: string) => {
      const loan = exhibition.flashLoans.find(l => l.id === loanId);
      if (!loan) return;

      const updated = manuallyOverrideJudgment(loan, newStatus, reason, currentUser);

      setExhibition(prev => ({
        ...prev,
        flashLoans: prev.flashLoans.map(l => (l.id === loanId ? updated : l)),
        updatedAt: new Date().toISOString(),
      }));
    },
    [exhibition.flashLoans, currentUser]
  );

  const generateFinalLayoutList = useCallback(() => {
    return generateLayoutList(exhibition, currentUser);
  }, [exhibition, currentUser]);

  const getUnconfirmedAnomalies = useCallback(() => {
    return exhibition.anomalies.filter(a => !a.confirmed);
  }, [exhibition.anomalies]);

  const getPendingConfirmations = useCallback(() => {
    return {
      anomalies: getUnconfirmedAnomalies(),
      changeLogs: exhibition.changeLogs.filter(cl => cl.requiresConfirmation && !cl.confirmed),
      artworks: exhibition.artworks.filter(a => a.status === 'pending_confirmation'),
    };
  }, [exhibition, getUnconfirmedAnomalies]);

  return {
    currentUser,
    exhibition,
    activeTab,
    setActiveTab,
    selectedFlashLoan,
    setSelectedFlashLoan,
    switchUser,
    confirmAnomaly,
    updateArtworkUnit,
    addCuratorNote,
    updateLightingRecord,
    submitFlashLoanRequest,
    overrideFlashLoanJudgment,
    generateFinalLayoutList,
    getUnconfirmedAnomalies,
    getPendingConfirmations,
    mockUsers,
  };
}
