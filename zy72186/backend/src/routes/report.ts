import { Router } from 'express';
import { db } from '../data/database';

const router = Router();

router.get('/', (_req, res) => {
  const report = db.generateReport();
  
  res.json({
    success: true,
    data: report,
  });
});

router.get('/export', (_req, res) => {
  const report = db.generateReport();
  const samples = db.getSamples();
  
  const exportData = {
    exportTime: new Date().toISOString(),
    report,
    samples: samples.map(s => ({
      id: s.id,
      contractId: s.contractId,
      contractName: s.contractName,
      clauseType: s.clauseType,
      modelExtraction: s.modelExtraction,
      importedLabel: s.importedLabel,
      manualLabel: s.manualLabel,
      status: s.status,
      isDuplicate: s.isDuplicate,
      isMissingRef: s.isMissingRef,
      hasManualOverride: s.hasManualOverride,
      hasModelImportConflict: s.hasModelImportConflict,
      lastReviewed: s.reviewHistory[0]?.timestamp || null,
      lastReviewer: s.reviewHistory[0]?.reviewer || null,
    })),
  };
  
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="review-report-${Date.now()}.json"`);
  
  res.json({
    success: true,
    data: exportData,
  });
});

export default router;
