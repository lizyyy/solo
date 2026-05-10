import { Router } from 'express';
import { vehicleController } from '../controllers/vehicleController';

const router = Router();

router.get('/', vehicleController.getAllVehicles);
router.get('/available', vehicleController.getAvailableVehicles);
router.get('/:id', vehicleController.getVehicleById);
router.post('/', vehicleController.createVehicle);
router.put('/:id', vehicleController.updateVehicle);
router.delete('/:id', vehicleController.deleteVehicle);
router.post('/:id/breakdown', vehicleController.reportBreakdown);

export default router;
