import { Router, type Request, type Response } from 'express';
import { versionControlController } from '../src/controllers/VersionControlController.js';

const router = Router();

router.get('/snapshots', (req: Request, res: Response) => versionControlController.listSnapshots(req, res));
router.get('/snapshots/active', (req: Request, res: Response) => versionControlController.getActiveSnapshot(req, res));
router.get('/snapshots/:snapshotId', (req: Request, res: Response) => versionControlController.getSnapshot(req, res));
router.put('/snapshots/:snapshotId/activate', (req: Request, res: Response) => versionControlController.setActiveSnapshot(req, res));
router.post('/snapshots', (req: Request, res: Response) => versionControlController.createSnapshot(req, res));
router.post('/rollback', (req: Request, res: Response) => versionControlController.rollback(req, res));
router.post('/undo/:logId', (req: Request, res: Response) => versionControlController.undoOperation(req, res));
router.get('/logs', (req: Request, res: Response) => versionControlController.listOperationLogs(req, res));
router.get('/compare/:snapshotId1/:snapshotId2', (req: Request, res: Response) => versionControlController.compareVersions(req, res));

export default router;
