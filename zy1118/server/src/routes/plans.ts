import { Router, Request, Response } from 'express';
import { planRepository } from '../repositories/planRepository';
import { validationService } from '../services/validationService';
import { comparisonService } from '../services/comparisonService';
import { reportService } from '../services/reportService';
import { ReportFormat, Hall, Booth, FlowZone, PowerZone } from '../types';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const plans = planRepository.findAll();
    res.json({
      success: true,
      data: plans
    });
  } catch (error) {
    console.error('Error fetching plans:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch plans'
    });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const plan = planRepository.findById(req.params.id);
    if (!plan) {
      return res.status(404).json({
        success: false,
        error: 'Plan not found'
      });
    }
    res.json({
      success: true,
      data: plan
    });
  } catch (error) {
    console.error('Error fetching plan:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch plan'
    });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, description, hall, booths, flowZones, powerZones } = req.body;

    if (!name || !hall) {
      return res.status(400).json({
        success: false,
        error: 'Name and hall are required'
      });
    }

    const plan = planRepository.create({
      name,
      description,
      hall,
      booths: booths || [],
      flowZones: flowZones || [],
      powerZones: powerZones || []
    });

    res.json({
      success: true,
      data: plan
    });
  } catch (error) {
    console.error('Error creating plan:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create plan'
    });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { name, description, hall, booths, flowZones, powerZones } = req.body;

    const updates: Partial<{
      name: string;
      description: string;
      hall: Hall;
      booths: Booth[];
      flowZones: FlowZone[];
      powerZones: PowerZone[];
    }> = {};

    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (hall !== undefined) updates.hall = hall;
    if (booths !== undefined) updates.booths = booths;
    if (flowZones !== undefined) updates.flowZones = flowZones;
    if (powerZones !== undefined) updates.powerZones = powerZones;

    const plan = planRepository.update(req.params.id, updates);

    if (!plan) {
      return res.status(404).json({
        success: false,
        error: 'Plan not found'
      });
    }

    res.json({
      success: true,
      data: plan
    });
  } catch (error) {
    console.error('Error updating plan:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update plan'
    });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const deleted = planRepository.delete(req.params.id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Plan not found'
      });
    }
    res.json({
      success: true,
      message: 'Plan deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting plan:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete plan'
    });
  }
});

router.get('/:id/validate', async (req: Request, res: Response) => {
  try {
    const plan = planRepository.findById(req.params.id);
    if (!plan) {
      return res.status(404).json({
        success: false,
        error: 'Plan not found'
      });
    }

    const results = validationService.validate(plan);

    res.json({
      success: true,
      data: {
        planId: plan.id,
        results
      }
    });
  } catch (error) {
    console.error('Error validating plan:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate plan'
    });
  }
});

router.get('/compare/:planAId/:planBId', async (req: Request, res: Response) => {
  try {
    const planA = planRepository.findById(req.params.planAId);
    const planB = planRepository.findById(req.params.planBId);

    if (!planA || !planB) {
      return res.status(404).json({
        success: false,
        error: 'One or both plans not found'
      });
    }

    const comparison = comparisonService.compare(planA, planB);

    res.json({
      success: true,
      data: comparison
    });
  } catch (error) {
    console.error('Error comparing plans:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to compare plans'
    });
  }
});

router.get('/:id/report', async (req: Request, res: Response) => {
  try {
    const plan = planRepository.findById(req.params.id);
    if (!plan) {
      return res.status(404).json({
        success: false,
        error: 'Plan not found'
      });
    }

    const format = (req.query.format as ReportFormat) || 'json';
    const report = reportService.generateReport(plan);

    if (format === 'json') {
      res.json({
        success: true,
        data: report
      });
    } else {
      const exported = reportService.exportReport(report, format);
      const contentType = format === 'html' ? 'text/html' : 'text/markdown';
      const extension = format === 'html' ? 'html' : 'md';
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${plan.name}-report.${extension}"`);
      res.send(exported);
    }
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate report'
    });
  }
});

export default router;
