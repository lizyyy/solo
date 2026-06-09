import { Router } from 'express';
import { routeController } from '../controllers/RouteController';

const router = Router();

router.get('/', routeController.getRoutes);
router.get('/export', routeController.exportRoutes);
router.get('/gaps', routeController.getAllGaps);
router.get('/gaps/open', routeController.getOpenGaps);
router.post('/gaps/review', routeController.reviewGap);
router.get('/:id', routeController.getRouteById);
router.delete('/:id', routeController.deleteRoute);
router.post('/', routeController.supplementRoute);
router.post('/recalculate', routeController.recalculate);
router.post('/detect-gaps', routeController.detectGaps);
router.get('/:routeId/changes', routeController.getRouteChanges);

export default router;
