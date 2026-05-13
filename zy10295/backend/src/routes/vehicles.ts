import express from 'express';
import vehicleService from '../services/vehicleService';

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const vehicles = vehicleService.getAllVehicles();
    res.json(vehicles);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/availability', (req, res) => {
  try {
    const availability = vehicleService.getAllVehiclesAvailability();
    res.json(availability);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/available', (req, res) => {
  try {
    const available = vehicleService.getAvailableVehicles();
    res.json(available);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const vehicle = vehicleService.getVehicleById(req.params.id);
    if (!vehicle) {
      return res.status(404).json({ error: '车辆不存在' });
    }
    res.json(vehicle);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/:id/tires', (req, res) => {
  try {
    const tires = vehicleService.getVehicleTires(req.params.id);
    res.json(tires);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/:id/availability', (req, res) => {
  try {
    const availability = vehicleService.getVehicleAvailability(req.params.id);
    res.json(availability);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/', (req, res) => {
  try {
    const vehicle = vehicleService.createVehicle(req.body);
    res.status(201).json(vehicle);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
