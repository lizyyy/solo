import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './index';
import { planRepository, historyRepository, materialRepository } from './repositories';
import type { OperationType } from '../../shared/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function seedDatabase() {
  const sampleDataPath = path.join(__dirname, '../../data/sample-plans.json');
  
  if (!fs.existsSync(sampleDataPath)) {
    console.log('Sample data file not found, skipping seed');
    return;
  }

  const isDev = process.env.NODE_ENV === 'development';
  const forceReset = process.env.RESET_DB_ON_START === 'true';

  if (isDev || forceReset) {
    console.log('Resetting database to clean sample data...');
    db.exec('DELETE FROM plans');
    const count = (db.prepare('SELECT COUNT(*) as count FROM plans').get() as { count: number }).count;
    if (count !== 0) {
      throw new Error(`Failed to reset database: ${count} plans remaining`);
    }
  } else {
    const existingCount = db.prepare('SELECT COUNT(*) as count FROM plans').get() as { count: number };
    if (existingCount.count > 0) {
      console.log('Database already has data, skipping seed');
      return;
    }
  }

  const rawData = fs.readFileSync(sampleDataPath, 'utf-8');
  const sampleData = JSON.parse(rawData);

  console.log('Seeding database with sample data...');

  for (const planData of sampleData.plans) {
    const plan = planRepository.create({
      planNo: planData.planNo,
      projectName: planData.projectName,
      originalOpinion: planData.originalOpinion,
      originalSource: planData.originalSource,
      currentRemark: planData.currentRemark,
      judgment: planData.judgment,
      status: planData.status,
      materialBatch: planData.materialBatch,
      createdBy: planData.createdBy,
    });

    const historyRecords = sampleData.historyRecords.find(
      (h: any) => h.planNo === planData.planNo
    );

    if (historyRecords) {
      for (const op of historyRecords.operations) {
        historyRepository.create({
          planId: plan.id,
          version: historyRepository.getNextVersion(plan.id, op.type as OperationType),
          operationType: op.type as OperationType,
          oldValue: op.oldValue,
          newValue: op.newValue,
          changeReason: op.reason,
          operator: op.operator,
        });
      }
    }

    const materials = sampleData.materials.filter(
      (m: any) => m.planNo === planData.planNo
    );

    for (const mat of materials) {
      materialRepository.create({
        planId: plan.id,
        batchNo: mat.batchNo,
        materialName: mat.materialName,
        quantity: mat.quantity,
        isSupplement: mat.isSupplement,
        supplementReason: mat.supplementReason,
      });
    }
  }

  console.log(`Seeded ${sampleData.plans.length} plans with history records`);
}
