import { store } from '../dataStore/inMemoryStore';
import { logger } from '../utils/logger';
import { addDays, addMonths } from 'date-fns';

async function seedData(): Promise<void> {
  logger.info('Starting data seeding...');

  try {
    store.clearAll();
    logger.info('Cleared existing data');

    const pesticides = [
      {
        name: '吡虫啉',
        registrationNumber: 'PD20100123',
        manufacturer: '江苏某农药厂',
        activeIngredient: '吡虫啉',
        concentration: '10%',
        formulation: '可湿性粉剂',
        category: 'INSECTICIDE' as const,
        toxicity: 'LOW_TOXIC' as const,
        storageConditions: '阴凉干燥处保存',
        usageInstructions: '按说明稀释后喷施'
      },
      {
        name: '多菌灵',
        registrationNumber: 'PD20080456',
        manufacturer: '山东某农药厂',
        activeIngredient: '多菌灵',
        concentration: '50%',
        formulation: '可湿性粉剂',
        category: 'FUNGICIDE' as const,
        toxicity: 'LOW_TOXIC' as const,
        storageConditions: '密封保存',
        usageInstructions: '发病初期喷施'
      },
      {
        name: '草甘膦',
        registrationNumber: 'PD20050789',
        manufacturer: '浙江某农药厂',
        activeIngredient: '草甘膦异丙胺盐',
        concentration: '41%',
        formulation: '水剂',
        category: 'HERBICIDE' as const,
        toxicity: 'LOW_TOXIC' as const,
        storageConditions: '远离食品和饲料',
        usageInstructions: '杂草旺盛生长期喷施'
      }
    ];

    const createdPesticides = pesticides.map(p => store.pesticidesStore().create(p));
    logger.info(`Created ${createdPesticides.length} pesticides`);

    const crops = [
      {
        name: '小麦',
        scientificName: 'Triticum aestivum',
        category: 'GRAIN' as const,
        growthCycle: '230-270天',
        plantingSeason: '秋季'
      },
      {
        name: '水稻',
        scientificName: 'Oryza sativa',
        category: 'GRAIN' as const,
        growthCycle: '120-150天',
        plantingSeason: '春季'
      },
      {
        name: '白菜',
        scientificName: 'Brassica rapa',
        category: 'VEGETABLE' as const,
        growthCycle: '60-90天',
        plantingSeason: '秋季'
      },
      {
        name: '番茄',
        scientificName: 'Solanum lycopersicum',
        category: 'VEGETABLE' as const,
        growthCycle: '90-120天',
        plantingSeason: '春季'
      }
    ];

    const createdCrops = crops.map(c => store.cropsStore().create(c));
    logger.info(`Created ${createdCrops.length} crops`);

    const now = new Date();
    const plots = [
      {
        plotNumber: 'P-001',
        name: '东区1号地块',
        area: 50,
        areaUnit: 'MU' as const,
        location: '农场东区',
        soilType: '壤土',
        currentCropId: createdCrops[0].id,
        plantingDate: addDays(now, -60),
        expectedHarvestDate: addDays(now, 120),
        status: 'PLANTED' as const
      },
      {
        plotNumber: 'P-002',
        name: '东区2号地块',
        area: 40,
        areaUnit: 'MU' as const,
        location: '农场东区',
        soilType: '沙壤土',
        currentCropId: createdCrops[1].id,
        plantingDate: addDays(now, -30),
        expectedHarvestDate: addDays(now, 90),
        status: 'PLANTED' as const
      },
      {
        plotNumber: 'P-003',
        name: '西区1号地块',
        area: 30,
        areaUnit: 'MU' as const,
        location: '农场西区',
        soilType: '粘土',
        currentCropId: createdCrops[2].id,
        plantingDate: addDays(now, -20),
        expectedHarvestDate: addDays(now, 50),
        status: 'PLANTED' as const
      },
      {
        plotNumber: 'P-004',
        name: '西区2号地块',
        area: 25,
        areaUnit: 'MU' as const,
        location: '农场西区',
        soilType: '壤土',
        currentCropId: null,
        plantingDate: null,
        expectedHarvestDate: null,
        status: 'AVAILABLE' as const
      }
    ];

    const createdPlots = plots.map(p => store.plotsStore().create(p));
    logger.info(`Created ${createdPlots.length} plots`);

    const intervalRules = [
      {
        pesticideId: createdPesticides[0].id,
        cropId: createdCrops[0].id,
        safetyIntervalDays: 21,
        maxApplicationsPerSeason: 3,
        minIntervalBetweenApplications: 14,
        maxDosagePerApplication: '20g/亩',
        isActive: true
      },
      {
        pesticideId: createdPesticides[0].id,
        cropId: createdCrops[1].id,
        safetyIntervalDays: 30,
        maxApplicationsPerSeason: 4,
        minIntervalBetweenApplications: 15,
        maxDosagePerApplication: '25g/亩',
        isActive: true
      },
      {
        pesticideId: createdPesticides[1].id,
        cropId: createdCrops[2].id,
        safetyIntervalDays: 14,
        maxApplicationsPerSeason: 2,
        minIntervalBetweenApplications: 10,
        maxDosagePerApplication: '100g/亩',
        isActive: true
      },
      {
        pesticideId: createdPesticides[1].id,
        cropId: createdCrops[3].id,
        safetyIntervalDays: 7,
        maxApplicationsPerSeason: 3,
        minIntervalBetweenApplications: 7,
        maxDosagePerApplication: '150g/亩',
        isActive: true
      }
    ];

    const createdRules = intervalRules.map(r => store.intervalRulesStore().create(r));
    logger.info(`Created ${createdRules.length} interval rules`);

    const inventories = [
      {
        pesticideId: createdPesticides[0].id,
        batchNumber: 'B2024001',
        quantity: 500,
        unit: 'KG' as const,
        expiryDate: addMonths(now, 12),
        warehouse: '一号仓库',
        inboundDate: addDays(now, -30),
        supplier: '供应商A'
      },
      {
        pesticideId: createdPesticides[0].id,
        batchNumber: 'B2024002',
        quantity: 300,
        unit: 'KG' as const,
        expiryDate: addMonths(now, 18),
        warehouse: '一号仓库',
        inboundDate: addDays(now, -15),
        supplier: '供应商B'
      },
      {
        pesticideId: createdPesticides[1].id,
        batchNumber: 'B2024003',
        quantity: 800,
        unit: 'KG' as const,
        expiryDate: addMonths(now, 24),
        warehouse: '二号仓库',
        inboundDate: addDays(now, -45),
        supplier: '供应商A'
      },
      {
        pesticideId: createdPesticides[2].id,
        batchNumber: 'B2024004',
        quantity: 200,
        unit: 'L' as const,
        expiryDate: addMonths(now, 6),
        warehouse: '一号仓库',
        inboundDate: addDays(now, -60),
        supplier: '供应商C'
      }
    ];

    const createdInventories = inventories.map(i => store.inventoriesStore().create(i));
    logger.info(`Created ${createdInventories.length} inventory records`);

    const sampleRequisition = store.requisitionsStore().create({
      applicantId: 'user-001',
      applicantName: '张三',
      department: '生产一部',
      intendedUseDate: addDays(now, 3),
      status: 'DRAFT',
      currentStage: 'DRAFT',
      totalItems: 0,
      totalQuantity: 0,
      rejectionReason: null,
      lastProcessedById: null,
      lastProcessedAt: null
    });

    const sampleItems = [
      {
        requisitionId: sampleRequisition.id,
        pesticideId: createdPesticides[0].id,
        pesticideName: createdPesticides[0].name,
        quantity: 10,
        unit: 'KG' as const,
        usagePurpose: '防治蚜虫',
        dosagePerUnitArea: '20g/亩',
        plotId: createdPlots[0].id,
        plotName: createdPlots[0].name,
        cropId: createdCrops[0].id,
        cropName: createdCrops[0].name,
        applicationMethod: '喷雾',
        expectedApplicationDate: addDays(now, 3)
      },
      {
        requisitionId: sampleRequisition.id,
        pesticideId: createdPesticides[1].id,
        pesticideName: createdPesticides[1].name,
        quantity: 15,
        unit: 'KG' as const,
        usagePurpose: '防治纹枯病',
        dosagePerUnitArea: '100g/亩',
        plotId: createdPlots[2].id,
        plotName: createdPlots[2].name,
        cropId: createdCrops[2].id,
        cropName: createdCrops[2].name,
        applicationMethod: '喷雾',
        expectedApplicationDate: addDays(now, 5)
      }
    ];

    const createdItems = sampleItems.map(item => store.requisitionItemsStore().create(item));
    
    store.requisitionsStore().update(sampleRequisition.id, {
      totalItems: createdItems.length,
      totalQuantity: createdItems.reduce((sum, item) => sum + item.quantity, 0)
    });

    logger.info(`Created sample requisition with ${createdItems.length} items`);

    logger.info('\n=== Seed Data Summary ===');
    logger.info(`Pesticides: ${createdPesticides.length}`);
    logger.info(`Crops: ${createdCrops.length}`);
    logger.info(`Plots: ${createdPlots.length}`);
    logger.info(`Interval Rules: ${createdRules.length}`);
    logger.info(`Inventories: ${createdInventories.length}`);
    logger.info(`Sample Requisition: 1`);
    logger.info('\nData seeding completed successfully!');

    logger.info('\n=== Sample Data IDs ===');
    logger.info(`小麦 (Crop): ${createdCrops[0].id}`);
    logger.info(`水稻 (Crop): ${createdCrops[1].id}`);
    logger.info(`白菜 (Crop): ${createdCrops[2].id}`);
    logger.info(`吡虫啉 (Pesticide): ${createdPesticides[0].id}`);
    logger.info(`多菌灵 (Pesticide): ${createdPesticides[1].id}`);
    logger.info(`东区1号地块 (Plot): ${createdPlots[0].id}`);
    logger.info(`西区1号地块 (Plot): ${createdPlots[2].id}`);
    logger.info(`Sample Requisition: ${sampleRequisition.id}`);

  } catch (error) {
    logger.error('Data seeding failed', error as Error);
    process.exit(1);
  }
}

seedData();
