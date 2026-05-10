const Patient = require('../models/Patient');
const Drug = require('../models/Drug');

const parseFrequency = (frequency) => {
  const frequencyMap = {
    '每日1次': 1,
    '每日2次': 2,
    '每日3次': 3,
    '每日4次': 4,
    '每8小时1次': 3,
    '每12小时1次': 2,
    '每6小时1次': 4,
    '每晚1次': 1,
    '每晨1次': 1
  };
  return frequencyMap[frequency] || 1;
};

const parseDosage = (dosage) => {
  const match = dosage.match(/(\d+\.?\d*)/);
  return match ? parseFloat(match[1]) : 0;
};

const checkAllergyConflict = async (patientId, items) => {
  const risks = [];
  const patient = await Patient.findById(patientId);
  
  if (!patient || !patient.allergies || patient.allergies.length === 0) {
    return risks;
  }

  const allergyNames = patient.allergies.map(a => a.drugName.toLowerCase());
  
  for (const item of items) {
    const drug = await Drug.findById(item.drugId);
    if (!drug) continue;

    if (allergyNames.includes(drug.name.toLowerCase())) {
      const allergy = patient.allergies.find(a => a.drugName.toLowerCase() === drug.name.toLowerCase());
      risks.push({
        type: '过敏风险',
        category: '过敏风险',
        severity: allergy.severity === '重度' ? '高' : '中',
        description: `患者对${drug.name}有${allergy.severity}过敏史，请确认是否需要更换药物`
      });
    }

    if (drug.activeIngredients) {
      for (const ingredient of drug.activeIngredients) {
        if (allergyNames.includes(ingredient.name.toLowerCase())) {
          const allergy = patient.allergies.find(a => a.drugName.toLowerCase() === ingredient.name.toLowerCase());
          risks.push({
            type: '过敏风险',
            category: '过敏风险',
            severity: '高',
            description: `患者对药物成分${ingredient.name}有过敏史，${drug.name}含有该成分`
          });
        }
      }
    }
  }

  return risks;
};

const checkDuplicateIngredients = async (items) => {
  const risks = [];
  const ingredientMap = new Map();

  for (const item of items) {
    const drug = await Drug.findById(item.drugId);
    if (!drug || !drug.activeIngredients) continue;

    for (const ingredient of drug.activeIngredients) {
      if (ingredientMap.has(ingredient.name)) {
        const existing = ingredientMap.get(ingredient.name);
        existing.drugs.push(drug.name);
        existing.count++;
      } else {
        ingredientMap.set(ingredient.name, {
          ingredient: ingredient.name,
          drugs: [drug.name],
          count: 1
        });
      }
    }
  }

  for (const [ingredient, data] of ingredientMap) {
    if (data.count > 1) {
      risks.push({
        type: '重复成分',
        category: '重复成分',
        severity: '中',
        description: `药物${data.drugs.join('、')}均含有成分${ingredient}，可能存在重复用药风险`
      });
    }
  }

  return risks;
};

const checkDosageLimit = async (items) => {
  const risks = [];

  for (const item of items) {
    const drug = await Drug.findById(item.drugId);
    if (!drug) continue;

    const dosageValue = parseDosage(item.dosage);
    const frequencyValue = parseFrequency(item.frequency);
    const dailyDose = dosageValue * frequencyValue;

    if (drug.maxDosePerDay && dailyDose > drug.maxDosePerDay) {
      risks.push({
        type: '剂量超限',
        category: '剂量超限',
        severity: '高',
        description: `${drug.name}日剂量${dailyDose}${drug.unit}超过每日最大推荐剂量${drug.maxDosePerDay}${drug.unit}，请确认剂量是否正确`
      });
    }

    if (drug.maxDosePerCourse && item.quantity > drug.maxDosePerCourse) {
      risks.push({
        type: '剂量超限',
        category: '剂量超限',
        severity: '中',
        description: `${drug.name}开药量${item.quantity}${drug.unit}超过单疗程最大量${drug.maxDosePerCourse}${drug.unit}`
      });
    }
  }

  return risks;
};

const validatePrescription = async (prescriptionData) => {
  const allRisks = [];

  const allergyRisks = await checkAllergyConflict(prescriptionData.patientId, prescriptionData.items);
  allRisks.push(...allergyRisks);

  const duplicateRisks = await checkDuplicateIngredients(prescriptionData.items);
  allRisks.push(...duplicateRisks);

  const dosageRisks = await checkDosageLimit(prescriptionData.items);
  allRisks.push(...dosageRisks);

  const hasHighRisk = allRisks.some(r => r.severity === '高');
  const canDispense = !hasHighRisk;

  return {
    risks: allRisks,
    riskLevel: hasHighRisk ? '高' : (allRisks.length > 0 ? '中' : '低'),
    canDispense
  };
};

const canDispensePrescription = (prescription) => {
  if (!prescription) return false;
  if (prescription.status !== '已通过') return false;
  if (prescription.risks && prescription.risks.some(r => r.severity === '高')) {
    return false;
  }
  return prescription.canDispense === true;
};

module.exports = {
  validatePrescription,
  canDispensePrescription,
  parseDosage,
  parseFrequency
};
