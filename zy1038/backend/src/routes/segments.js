import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { storageService } from '../services/storage.js';
import { auditService } from '../services/auditService.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const segments = await storageService.getSegments();
    res.json(segments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const segments = await storageService.getSegments();
    const segment = segments.find(s => s.id === req.params.id);
    
    if (!segment) {
      return res.status(404).json({ error: 'Segment not found' });
    }
    
    res.json(segment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const segments = await storageService.getSegments();
    const newSegment = {
      id: uuidv4(),
      name: req.body.name,
      description: req.body.description,
      conditions: req.body.conditions || [],
      createdAt: new Date().toISOString()
    };
    
    segments.push(newSegment);
    await storageService.saveSegments(segments);
    
    await auditService.logCreate(
      'SEGMENT',
      newSegment,
      `创建 Segment: ${newSegment.name}`
    );
    
    res.status(201).json(newSegment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const segments = await storageService.getSegments();
    const index = segments.findIndex(s => s.id === req.params.id);
    
    if (index === -1) {
      return res.status(404).json({ error: 'Segment not found' });
    }
    
    const oldValue = { ...segments[index] };
    
    const updatedSegment = {
      ...segments[index],
      name: req.body.name ?? segments[index].name,
      description: req.body.description ?? segments[index].description,
      conditions: req.body.conditions ?? segments[index].conditions,
      updatedAt: new Date().toISOString()
    };
    
    segments[index] = updatedSegment;
    await storageService.saveSegments(segments);
    
    await auditService.logUpdate(
      'SEGMENT',
      req.params.id,
      oldValue,
      updatedSegment,
      `更新 Segment: ${updatedSegment.name}`
    );
    
    res.json(updatedSegment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const segments = await storageService.getSegments();
    const index = segments.findIndex(s => s.id === req.params.id);
    
    if (index === -1) {
      return res.status(404).json({ error: 'Segment not found' });
    }
    
    const deletedSegment = segments.splice(index, 1)[0];
    await storageService.saveSegments(segments);
    
    await auditService.logDelete(
      'SEGMENT',
      req.params.id,
      deletedSegment,
      `删除 Segment: ${deletedSegment.name}`
    );
    
    res.json({ success: true, deleted: deletedSegment });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
