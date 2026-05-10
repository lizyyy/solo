import { Router, Request, Response, NextFunction } from 'express';
import { ApiResponse, Pesticide, Crop, Plot, IntervalRule } from '../types';
import { store } from '../dataStore/inMemoryStore';
import { intervalRuleService } from '../services/intervalRuleService';
import { ValidationError, NotFoundError } from '../utils/errors';

const router = Router();

function successResponse<T>(req: Request, data: T): ApiResponse<T> {
  return {
    success: true,
    data,
    timestamp: new Date(),
    requestId: req.requestId
  };
}

router.get('/pesticides', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pesticides = store.pesticidesStore().findAll();
    res.json(successResponse(req, pesticides));
  } catch (error) {
    next(error);
  }
});

router.get('/pesticides/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pesticide = store.pesticidesStore().findById(req.params.id);
    if (!pesticide) {
      throw new NotFoundError('Pesticide', req.params.id);
    }
    res.json(successResponse(req, pesticide));
  } catch (error) {
    next(error);
  }
});

router.post('/pesticides', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      name,
      registrationNumber,
      manufacturer,
      activeIngredient,
      concentration,
      formulation,
      category,
      toxicity,
      storageConditions,
      usageInstructions
    } = req.body;

    if (!name || !registrationNumber) {
      throw new ValidationError('农药名称和登记证号不能为空');
    }

    const pesticide = store.pesticidesStore().create({
      name,
      registrationNumber,
      manufacturer: manufacturer || '',
      activeIngredient: activeIngredient || '',
      concentration: concentration || '',
      formulation: formulation || '',
      category: category || 'OTHER',
      toxicity: toxicity || 'LOW_TOXIC',
      storageConditions: storageConditions || '',
      usageInstructions: usageInstructions || ''
    });

    res.status(201).json(successResponse(req, pesticide));
  } catch (error) {
    next(error);
  }
});

router.get('/crops', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const crops = store.cropsStore().findAll();
    res.json(successResponse(req, crops));
  } catch (error) {
    next(error);
  }
});

router.get('/crops/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const crop = store.cropsStore().findById(req.params.id);
    if (!crop) {
      throw new NotFoundError('Crop', req.params.id);
    }
    res.json(successResponse(req, crop));
  } catch (error) {
    next(error);
  }
});

router.post('/crops', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, scientificName, category, growthCycle, plantingSeason } = req.body;

    if (!name) {
      throw new ValidationError('作物名称不能为空');
    }

    const crop = store.cropsStore().create({
      name,
      scientificName: scientificName || '',
      category: category || 'OTHER',
      growthCycle: growthCycle || '',
      plantingSeason: plantingSeason || ''
    });

    res.status(201).json(successResponse(req, crop));
  } catch (error) {
    next(error);
  }
});

router.get('/plots', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const plots = store.plotsStore().findAll();
    res.json(successResponse(req, plots));
  } catch (error) {
    next(error);
  }
});

router.get('/plots/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const plot = store.plotsStore().findById(req.params.id);
    if (!plot) {
      throw new NotFoundError('Plot', req.params.id);
    }
    res.json(successResponse(req, plot));
  } catch (error) {
    next(error);
  }
});

router.post('/plots', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      plotNumber,
      name,
      area,
      areaUnit,
      location,
      soilType,
      currentCropId,
      plantingDate,
      expectedHarvestDate,
      status
    } = req.body;

    if (!plotNumber || !name || area == null) {
      throw new ValidationError('地块编号、名称和面积不能为空');
    }

    const plot = store.plotsStore().create({
      plotNumber,
      name,
      area: Number(area),
      areaUnit: areaUnit || 'MU',
      location: location || '',
      soilType: soilType || '',
      currentCropId: currentCropId || null,
      plantingDate: plantingDate ? new Date(plantingDate) : null,
      expectedHarvestDate: expectedHarvestDate ? new Date(expectedHarvestDate) : null,
      status: status || 'AVAILABLE'
    });

    res.status(201).json(successResponse(req, plot));
  } catch (error) {
    next(error);
  }
});

router.put('/plots/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      name,
      area,
      areaUnit,
      location,
      soilType,
      currentCropId,
      plantingDate,
      expectedHarvestDate,
      status
    } = req.body;

    const existing = store.plotsStore().findById(req.params.id);
    if (!existing) {
      throw new NotFoundError('Plot', req.params.id);
    }

    const updates: Partial<Plot> = {};
    if (name !== undefined) updates.name = name;
    if (area !== undefined) updates.area = Number(area);
    if (areaUnit !== undefined) updates.areaUnit = areaUnit;
    if (location !== undefined) updates.location = location;
    if (soilType !== undefined) updates.soilType = soilType;
    if (currentCropId !== undefined) updates.currentCropId = currentCropId;
    if (plantingDate !== undefined) updates.plantingDate = plantingDate ? new Date(plantingDate) : null;
    if (expectedHarvestDate !== undefined) updates.expectedHarvestDate = expectedHarvestDate ? new Date(expectedHarvestDate) : null;
    if (status !== undefined) updates.status = status;

    const updated = store.plotsStore().update(req.params.id, updates);
    res.json(successResponse(req, updated));
  } catch (error) {
    next(error);
  }
});

router.get('/interval-rules', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rules = store.intervalRulesStore().findAll();
    res.json(successResponse(req, rules));
  } catch (error) {
    next(error);
  }
});

router.get('/interval-rules/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rule = store.intervalRulesStore().findById(req.params.id);
    if (!rule) {
      throw new NotFoundError('IntervalRule', req.params.id);
    }
    res.json(successResponse(req, rule));
  } catch (error) {
    next(error);
  }
});

router.post('/interval-rules', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      pesticideId,
      cropId,
      safetyIntervalDays,
      maxApplicationsPerSeason,
      minIntervalBetweenApplications,
      maxDosagePerApplication,
      isActive
    } = req.body;

    if (!pesticideId || !cropId || safetyIntervalDays == null) {
      throw new ValidationError('农药ID、作物ID和安全间隔期天数不能为空');
    }

    const rule = await intervalRuleService.createRule({
      pesticideId,
      cropId,
      safetyIntervalDays: Number(safetyIntervalDays),
      maxApplicationsPerSeason: Number(maxApplicationsPerSeason) || 1,
      minIntervalBetweenApplications: Number(minIntervalBetweenApplications) || 7,
      maxDosagePerApplication: maxDosagePerApplication || '',
      isActive: isActive !== false
    });

    res.status(201).json(successResponse(req, rule));
  } catch (error) {
    next(error);
  }
});

router.get('/interval-rules/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { pesticideId, cropId } = req.query;

    if (!pesticideId || !cropId) {
      throw new ValidationError('农药ID和作物ID不能为空');
    }

    const rules = store.intervalRulesStore().findByPesticideAndCrop(
      pesticideId as string,
      cropId as string
    );

    res.json(successResponse(req, rules));
  } catch (error) {
    next(error);
  }
});

export default router;
