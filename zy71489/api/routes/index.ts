import { Router } from 'express';
import tracksRouter from './tracks.js';
import importRouter from './import.js';
import votesRouter from './votes.js';
import copyrightRouter from './copyright.js';
import decisionsRouter from './decisions.js';
import auditRouter from './audit.js';
import badDataRouter from './bad-data.js';
import statsRouter from './stats.js';

const router = Router();

router.use('/tracks', tracksRouter);
router.use('/import', importRouter);
router.use('/votes', votesRouter);
router.use('/copyright', copyrightRouter);
router.use('/decisions', decisionsRouter);
router.use('/audit', auditRouter);
router.use('/bad-data', badDataRouter);
router.use('/stats', statsRouter);

export default router;
