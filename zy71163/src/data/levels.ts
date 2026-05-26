import type { LevelConfig, GameErrorType } from '@/types';

export const levels: LevelConfig[] = [
  {
    id: 'level_1',
    name: '新手入门',
    description: '学习基础配药流程，熟悉剂量核对',
    difficulty: 1,
    timeLimit: 300,
    prescriptionCount: 3,
    prescriptionTimeLimit: 90,
    readingTimeLimit: 30,
    errorTypes: ['dosage_unit', 'dosage_amount', 'wrong_medicine'],
    maxScore: 480
  },
  {
    id: 'level_2',
    name: '进阶挑战',
    description: '加入禁忌核对，注意患者过敏史',
    difficulty: 2,
    timeLimit: 360,
    prescriptionCount: 3,
    prescriptionTimeLimit: 100,
    readingTimeLimit: 30,
    errorTypes: ['dosage_unit', 'dosage_amount', 'contraindication', 'wrong_medicine'],
    maxScore: 540
  },
  {
    id: 'level_3',
    name: '批号核对',
    description: '新增批号和有效期检查，注意过期药品',
    difficulty: 3,
    timeLimit: 420,
    prescriptionCount: 3,
    prescriptionTimeLimit: 110,
    readingTimeLimit: 30,
    errorTypes: ['dosage_unit', 'dosage_amount', 'contraindication', 'batch_expired', 'wrong_medicine'],
    maxScore: 540
  },
  {
    id: 'level_4',
    name: '药物相互作用',
    description: '注意多种药物之间的相互作用',
    difficulty: 4,
    timeLimit: 480,
    prescriptionCount: 4,
    prescriptionTimeLimit: 100,
    readingTimeLimit: 30,
    errorTypes: ['dosage_unit', 'dosage_amount', 'contraindication', 'drug_interaction', 'batch_expired', 'wrong_medicine'],
    maxScore: 720
  },
  {
    id: 'level_5',
    name: '高级专家',
    description: '综合考核，限时压力下完成复杂处方',
    difficulty: 5,
    timeLimit: 540,
    prescriptionCount: 5,
    prescriptionTimeLimit: 90,
    readingTimeLimit: 25,
    errorTypes: ['dosage_unit', 'dosage_amount', 'contraindication', 'drug_interaction', 'batch_expired', 'wrong_medicine', 'repeated_operation', 'unchecked_confirm'],
    maxScore: 900
  }
];

export const getLevelById = (id: string): LevelConfig | undefined => {
  return levels.find(l => l.id === id);
};

export const getLevelMaxScore = (levelId: string): number => {
  const level = getLevelById(levelId);
  return level?.maxScore || 0;
};

export const getDifficultyStars = (difficulty: number): string => {
  return '⭐'.repeat(difficulty);
};

export const generatePrescriptionsForLevel = (levelId: string, prescriptions: any[]): any[] => {
  const level = getLevelById(levelId);
  if (!level) return [];
  
  const possibleErrorTypes = level.errorTypes;
  const selectedPrescriptions: any[] = [];
  
  const shuffled = [...prescriptions].sort(() => Math.random() - 0.5);
  
  for (let i = 0; i < Math.min(level.prescriptionCount, shuffled.length); i++) {
    const prescription = JSON.parse(JSON.stringify(shuffled[i]));
    const shouldInjectError = Math.random() > 0.3;
    
    if (shouldInjectError) {
      const errorType = possibleErrorTypes[Math.floor(Math.random() * possibleErrorTypes.length)];
      prescription.items = prescription.items.map((item: any) => {
        const modifiedItem = { ...item };
        
        switch (errorType) {
          case 'dosage_unit':
            modifiedItem.hasDosageError = true;
            modifiedItem.unit = modifiedItem.unit === 'g' ? 'mg' : 'g';
            break;
          case 'dosage_amount':
            modifiedItem.hasDosageError = true;
            modifiedItem.dosage = Math.round(modifiedItem.dosage * (Math.random() > 0.5 ? 2 : 0.5) * 100) / 100;
            break;
          case 'contraindication':
            modifiedItem.hasContraindication = true;
            break;
          case 'batch_expired':
            modifiedItem.hasBatchError = true;
            break;
          case 'wrong_medicine':
            modifiedItem.hasContraindication = true;
            break;
        }
        
        return modifiedItem;
      });
    }
    
    selectedPrescriptions.push(prescription);
  }
  
  return selectedPrescriptions;
};
