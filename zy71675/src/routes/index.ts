import { Router, Request, Response } from 'express';
import { TrackService, TrackCreateData, TrackUpdateData } from '../services/TrackService';
import { VersionService, MasterFileUploadData, CoverArtUploadData } from '../services/VersionService';
import { ValidationService } from '../services/ValidationService';
import { DeliveryService, DeliveryReportCreateData } from '../services/DeliveryService';
import { PlatformSpecService, PlatformSpecCreateData, PlatformSpecUpdateData } from '../services/PlatformSpecService';
import { AuditService } from '../services/AuditService';
import { AnomalyService } from '../services/AnomalyService';
import { DeliveryStatus, AnomalyStatus, AnomalySeverity, TrackStatus, EntityType } from '../entities/enums';

const router = Router();

const trackService = new TrackService();
const versionService = new VersionService();
const validationService = new ValidationService();
const deliveryService = new DeliveryService();
const platformSpecService = new PlatformSpecService();
const auditService = new AuditService();
const anomalyService = new AnomalyService();

router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// === Tracks ===
router.get('/tracks', async (req: Request, res: Response) => {
  try {
    const { status, search } = req.query;
    let tracks;
    if (search) {
      tracks = await trackService.searchTracks(String(search));
    } else if (status) {
      tracks = await trackService.getAllTracks(status as TrackStatus);
    } else {
      tracks = await trackService.getAllTracks();
    }
    res.json(tracks);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/tracks/stats', async (req: Request, res: Response) => {
  try {
    const stats = await trackService.getTrackStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/tracks/:id', async (req: Request, res: Response) => {
  try {
    const track = await trackService.getTrack(Number(req.params.id));
    if (!track) {
      return res.status(404).json({ error: '曲目不存在' });
    }
    res.json(track);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/tracks', async (req: Request, res: Response) => {
  try {
    const data = req.body as TrackCreateData;
    const track = await trackService.createTrack(data);
    res.status(201).json(track);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.put('/tracks/:id', async (req: Request, res: Response) => {
  try {
    const { modifiedBy, reason, ...data } = req.body;
    const track = await trackService.updateTrack(
      Number(req.params.id),
      data as TrackUpdateData,
      modifiedBy,
      reason
    );
    res.json(track);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.delete('/tracks/:id', async (req: Request, res: Response) => {
  try {
    await trackService.deleteTrack(Number(req.params.id));
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/tracks/:id/trace', async (req: Request, res: Response) => {
  try {
    const trace = await deliveryService.getDeliveryTrace(Number(req.params.id));
    res.json(trace);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// === Master Files ===
router.get('/tracks/:trackId/masters', async (req: Request, res: Response) => {
  try {
    const masters = await versionService.getMasterFileHistory(Number(req.params.trackId));
    res.json(masters);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/tracks/:trackId/masters/latest', async (req: Request, res: Response) => {
  try {
    const master = await versionService.getLatestMasterFile(Number(req.params.trackId));
    if (!master) {
      return res.status(404).json({ error: '没有找到母带文件' });
    }
    res.json(master);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/tracks/:trackId/masters/:version', async (req: Request, res: Response) => {
  try {
    const master = await versionService.getMasterFileVersion(
      Number(req.params.trackId),
      Number(req.params.version)
    );
    if (!master) {
      return res.status(404).json({ error: '指定版本的母带文件不存在' });
    }
    res.json(master);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/tracks/:trackId/masters', async (req: Request, res: Response) => {
  try {
    const data = req.body as MasterFileUploadData;
    const master = await versionService.uploadMasterFile(Number(req.params.trackId), data);
    res.status(201).json(master);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/tracks/:trackId/masters/:version/revert', async (req: Request, res: Response) => {
  try {
    const { revertedBy } = req.body;
    const master = await versionService.revertMasterToVersion(
      Number(req.params.trackId),
      Number(req.params.version),
      revertedBy
    );
    res.json(master);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/tracks/:trackId/masters/compare/:versionA/:versionB', async (req: Request, res: Response) => {
  try {
    const diff = await versionService.compareMasterVersions(
      Number(req.params.trackId),
      Number(req.params.versionA),
      Number(req.params.versionB)
    );
    res.json(diff);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// === Cover Arts ===
router.get('/tracks/:trackId/covers', async (req: Request, res: Response) => {
  try {
    const covers = await versionService.getCoverArtHistory(Number(req.params.trackId));
    res.json(covers);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/tracks/:trackId/covers/latest', async (req: Request, res: Response) => {
  try {
    const cover = await versionService.getLatestCoverArt(Number(req.params.trackId));
    if (!cover) {
      return res.status(404).json({ error: '没有找到封面文件' });
    }
    res.json(cover);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/tracks/:trackId/covers/:version', async (req: Request, res: Response) => {
  try {
    const cover = await versionService.getCoverArtVersion(
      Number(req.params.trackId),
      Number(req.params.version)
    );
    if (!cover) {
      return res.status(404).json({ error: '指定版本的封面文件不存在' });
    }
    res.json(cover);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/tracks/:trackId/covers', async (req: Request, res: Response) => {
  try {
    const data = req.body as CoverArtUploadData;
    const cover = await versionService.uploadCoverArt(Number(req.params.trackId), data);
    res.status(201).json(cover);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/tracks/:trackId/covers/:version/revert', async (req: Request, res: Response) => {
  try {
    const { revertedBy } = req.body;
    const cover = await versionService.revertCoverToVersion(
      Number(req.params.trackId),
      Number(req.params.version),
      revertedBy
    );
    res.json(cover);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/tracks/:trackId/covers/compare/:versionA/:versionB', async (req: Request, res: Response) => {
  try {
    const diff = await versionService.compareCoverVersions(
      Number(req.params.trackId),
      Number(req.params.versionA),
      Number(req.params.versionB)
    );
    res.json(diff);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// === Platform Specs ===
router.get('/platform-specs', async (req: Request, res: Response) => {
  try {
    const { includeInactive } = req.query;
    const specs = await platformSpecService.getAllPlatformSpecs(includeInactive === 'true');
    res.json(specs);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/platform-specs/:id', async (req: Request, res: Response) => {
  try {
    const spec = await platformSpecService.getPlatformSpec(Number(req.params.id));
    if (!spec) {
      return res.status(404).json({ error: '平台规格不存在' });
    }
    res.json(spec);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/platform-specs', async (req: Request, res: Response) => {
  try {
    const data = req.body as PlatformSpecCreateData;
    const spec = await platformSpecService.createPlatformSpec(data);
    res.status(201).json(spec);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.put('/platform-specs/:id', async (req: Request, res: Response) => {
  try {
    const { modifiedBy, reason, ...data } = req.body;
    const spec = await platformSpecService.updatePlatformSpec(
      Number(req.params.id),
      data as PlatformSpecUpdateData,
      modifiedBy,
      reason
    );
    res.json(spec);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// === Validation ===
router.post('/masters/:id/validate', async (req: Request, res: Response) => {
  try {
    const { validatedBy } = req.body;
    const master = await validationService.validateMasterFile(Number(req.params.id), validatedBy);
    res.json(master);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/masters/:masterId/validate-against/:specId', async (req: Request, res: Response) => {
  try {
    const result = await validationService.validateMasterFileAgainstSpec(
      Number(req.params.masterId),
      Number(req.params.specId)
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/covers/:id/validate', async (req: Request, res: Response) => {
  try {
    const { validatedBy } = req.body;
    const cover = await validationService.validateCoverArt(Number(req.params.id), validatedBy);
    res.json(cover);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/covers/:coverId/validate-against/:specId', async (req: Request, res: Response) => {
  try {
    const result = await validationService.validateCoverArtAgainstSpec(
      Number(req.params.coverId),
      Number(req.params.specId)
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// === Delivery Reports ===
router.get('/delivery-reports', async (req: Request, res: Response) => {
  try {
    const { trackId, platformSpecId, status } = req.query;
    let reports;
    if (trackId) {
      reports = await deliveryService.getDeliveryReportsByTrack(Number(trackId));
    } else if (platformSpecId) {
      reports = await deliveryService.getDeliveryReportsByPlatform(Number(platformSpecId));
    } else if (status) {
      reports = await deliveryService.getDeliveryReportsByStatus(status as DeliveryStatus);
    } else {
      reports = await deliveryService.getAllDeliveryReports();
    }
    res.json(reports);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/delivery-reports/:id', async (req: Request, res: Response) => {
  try {
    const report = await deliveryService.getDeliveryReport(Number(req.params.id));
    if (!report) {
      return res.status(404).json({ error: '交付报告不存在' });
    }
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/delivery-reports/:id/export', async (req: Request, res: Response) => {
  try {
    const csv = await deliveryService.exportDeliveryReportToCSV(Number(req.params.id));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="delivery-report-${req.params.id}.csv"`);
    res.send('\uFEFF' + csv);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/delivery-reports/export/all', async (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    const csv = await deliveryService.exportAllDeliveryReportsToCSV(
      status ? (status as DeliveryStatus) : undefined
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="delivery-reports.csv"');
    res.send('\uFEFF' + csv);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/delivery-reports', async (req: Request, res: Response) => {
  try {
    const data = req.body as DeliveryReportCreateData;
    const report = await deliveryService.createDeliveryReport(data);
    res.status(201).json(report);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/delivery-reports/:id/validate', async (req: Request, res: Response) => {
  try {
    const { validatedBy } = req.body;
    const report = await deliveryService.validateDeliveryReport(Number(req.params.id), validatedBy);
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/delivery-reports/:id/approve', async (req: Request, res: Response) => {
  try {
    const { approvedBy, approvalNotes } = req.body;
    const report = await deliveryService.approveDeliveryReport(
      Number(req.params.id),
      approvedBy,
      approvalNotes
    );
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/delivery-reports/:id/reject', async (req: Request, res: Response) => {
  try {
    const { rejectedBy, rejectionReason } = req.body;
    const report = await deliveryService.rejectDeliveryReport(
      Number(req.params.id),
      rejectedBy,
      rejectionReason
    );
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/delivery-reports/:id/deliver', async (req: Request, res: Response) => {
  try {
    const { deliveredBy, deliveryBatchId, externalReferenceId, deliveryLog } = req.body;
    const report = await deliveryService.markAsDelivered(
      Number(req.params.id),
      deliveredBy,
      deliveryBatchId,
      externalReferenceId,
      deliveryLog
    );
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/delivery-reports/:id/acknowledge', async (req: Request, res: Response) => {
  try {
    const { acknowledgedBy } = req.body;
    const report = await deliveryService.acknowledgeDelivery(
      Number(req.params.id),
      acknowledgedBy
    );
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.put('/delivery-reports/:id/files', async (req: Request, res: Response) => {
  try {
    const { masterFileId, coverArtId, updatedBy } = req.body;
    const report = await deliveryService.updateDeliveryReportFiles(
      Number(req.params.id),
      masterFileId,
      coverArtId,
      updatedBy
    );
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/delivery-reports/:id/use-latest', async (req: Request, res: Response) => {
  try {
    const { updatedBy } = req.body;
    const report = await deliveryService.autoUseLatestFiles(Number(req.params.id), updatedBy);
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// === Audit Logs ===
router.get('/audit/tracks/:trackId', async (req: Request, res: Response) => {
  try {
    const logs = await auditService.getTrackFullHistory(Number(req.params.trackId));
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/audit/:entityType/:entityId', async (req: Request, res: Response) => {
  try {
    const logs = await auditService.getEntityHistory(
      req.params.entityType as EntityType,
      Number(req.params.entityId)
    );
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/audit/recent', async (req: Request, res: Response) => {
  try {
    const { limit } = req.query;
    const logs = await auditService.getRecentChanges(limit ? Number(limit) : 50);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// === Anomalies ===
router.get('/anomalies', async (req: Request, res: Response) => {
  try {
    const { trackId, status, severity } = req.query;
    let anomalies;
    if (trackId) {
      anomalies = await anomalyService.getAnomaliesByTrack(
        Number(trackId),
        status ? (status as AnomalyStatus) : undefined
      );
    } else if (severity) {
      anomalies = await anomalyService.getAnomaliesBySeverity(
        severity as AnomalySeverity,
        status ? (status as AnomalyStatus) : undefined
      );
    } else if (status === 'open' || !status) {
      anomalies = await anomalyService.getOpenAnomalies(
        severity ? (severity as AnomalySeverity) : undefined
      );
    } else {
      anomalies = await anomalyService.getAnomaliesBySeverity(
        AnomalySeverity.HIGH,
        status as AnomalyStatus
      );
    }
    res.json(anomalies);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/anomalies/summary', async (req: Request, res: Response) => {
  try {
    const summary = await anomalyService.getAnomalySummary();
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/anomalies/:id', async (req: Request, res: Response) => {
  try {
    const anomaly = await anomalyService.getAnomalyWithFullTrace(Number(req.params.id));
    if (!anomaly) {
      return res.status(404).json({ error: '异常记录不存在' });
    }
    res.json(anomaly);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/anomalies/:id/resolve', async (req: Request, res: Response) => {
  try {
    const { resolvedBy, resolutionNote } = req.body;
    const anomaly = await anomalyService.resolveAnomaly(
      Number(req.params.id),
      resolvedBy,
      resolutionNote
    );
    res.json(anomaly);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/anomalies/:id/ignore', async (req: Request, res: Response) => {
  try {
    const { resolvedBy, resolutionNote } = req.body;
    const anomaly = await anomalyService.ignoreAnomaly(
      Number(req.params.id),
      resolvedBy,
      resolutionNote
    );
    res.json(anomaly);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/anomalies/scan', async (req: Request, res: Response) => {
  try {
    const anomalies = await anomalyService.scanAllAnomalies();
    res.json({
      scanned: true,
      anomaliesFound: anomalies.length,
      anomalies,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
