import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import ProblemType from '../models/ProblemType';
import GridWorker from '../models/GridWorker';
import ResponsibleUnit from '../models/ResponsibleUnit';

const router = express.Router();

router.get('/problem-types', async (req, res) => {
  try {
    const types = await ProblemType.findAll({ where: { isActive: true } });
    res.json(types);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/problem-types', async (req, res) => {
  try {
    const type = await ProblemType.create({
      id: uuidv4(),
      ...req.body,
      isActive: true
    });
    res.json(type);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/grid-workers', async (req, res) => {
  try {
    const workers = await GridWorker.findAll({ where: { isActive: true } });
    res.json(workers);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/grid-workers', async (req, res) => {
  try {
    const worker = await GridWorker.create({
      id: uuidv4(),
      ...req.body,
      isActive: true
    });
    res.json(worker);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/responsible-units', async (req, res) => {
  try {
    const units = await ResponsibleUnit.findAll({ where: { isActive: true } });
    res.json(units);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/responsible-units', async (req, res) => {
  try {
    const unit = await ResponsibleUnit.create({
      id: uuidv4(),
      ...req.body,
      isActive: true
    });
    res.json(unit);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
