import { HazardCategory, CorrosiveSubType, Chemical } from '../types';

export const CHEMICALS: Chemical[] = [
  {
    id: 'picric_acid',
    name: '苦味酸',
    formula: 'C₆H₃N₃O₇',
    category: HazardCategory.EXPLOSIVE,
    icon: '💥',
    hazardLevel: 5,
    storageRequirements: {
      minTemp: 0,
      maxTemp: 30,
      maxHumidity: 80,
      isolationDistance: 2
    },
    specialZones: ['explosion_proof'],
    description: '黄色晶体，遇明火、高温、撞击易爆炸，需单独存放于防爆柜。'
  },
  {
    id: 'nitroglycerin',
    name: '硝化甘油',
    formula: 'C₃H₅N₃O₉',
    category: HazardCategory.EXPLOSIVE,
    icon: '💥',
    hazardLevel: 5,
    storageRequirements: {
      minTemp: 5,
      maxTemp: 25,
      maxHumidity: 70,
      isolationDistance: 2
    },
    specialZones: ['explosion_proof'],
    description: '无色油状液体，极度敏感，轻微震动即可爆炸。'
  },
  {
    id: 'ethanol',
    name: '乙醇',
    formula: 'C₂H₅OH',
    category: HazardCategory.FLAMMABLE,
    icon: '🔥',
    hazardLevel: 3,
    storageRequirements: {
      minTemp: -10,
      maxTemp: 35,
      maxHumidity: 85,
      isolationDistance: 0
    },
    description: '无色透明液体，易燃，蒸气与空气可形成爆炸性混合物。'
  },
  {
    id: 'acetone',
    name: '丙酮',
    formula: 'CH₃COCH₃',
    category: HazardCategory.FLAMMABLE,
    icon: '🔥',
    hazardLevel: 3,
    storageRequirements: {
      minTemp: -20,
      maxTemp: 35,
      maxHumidity: 80,
      isolationDistance: 0
    },
    description: '无色透明易挥发液体，极度易燃，与氧化剂剧烈反应。'
  },
  {
    id: 'gasoline',
    name: '汽油',
    formula: 'C₅-C₁₂',
    category: HazardCategory.FLAMMABLE,
    icon: '🔥',
    hazardLevel: 4,
    storageRequirements: {
      minTemp: -20,
      maxTemp: 30,
      maxHumidity: 75,
      isolationDistance: 1
    },
    description: '淡黄色易挥发液体，闪点低，极易燃烧爆炸。'
  },
  {
    id: 'kmno4',
    name: '高锰酸钾',
    formula: 'KMnO₄',
    category: HazardCategory.OXIDIZER,
    icon: '⚡',
    hazardLevel: 4,
    storageRequirements: {
      minTemp: 0,
      maxTemp: 35,
      maxHumidity: 70,
      isolationDistance: 1
    },
    description: '深紫色晶体，强氧化剂，与有机物、还原剂接触易爆炸。'
  },
  {
    id: 'h2o2',
    name: '双氧水',
    formula: 'H₂O₂',
    category: HazardCategory.OXIDIZER,
    icon: '⚡',
    hazardLevel: 3,
    storageRequirements: {
      minTemp: 0,
      maxTemp: 30,
      maxHumidity: 80,
      isolationDistance: 1
    },
    specialZones: ['refrigerated'],
    description: '无色透明液体，受热分解产生氧气，与可燃物接触易爆炸。'
  },
  {
    id: 'kcn',
    name: '氰化钾',
    formula: 'KCN',
    category: HazardCategory.TOXIC,
    icon: '☠️',
    hazardLevel: 5,
    storageRequirements: {
      minTemp: 0,
      maxTemp: 35,
      maxHumidity: 60,
      isolationDistance: 1
    },
    specialZones: ['toxic'],
    description: '白色结晶粉末，剧毒，微量即可致死，需专人专柜保管。'
  },
  {
    id: 'as2o3',
    name: '砒霜',
    formula: 'As₂O₃',
    category: HazardCategory.TOXIC,
    icon: '☠️',
    hazardLevel: 5,
    storageRequirements: {
      minTemp: 0,
      maxTemp: 35,
      maxHumidity: 65,
      isolationDistance: 1
    },
    specialZones: ['toxic'],
    description: '白色粉末，剧毒，无臭无味，吸入或食入可致命。'
  },
  {
    id: 'h2so4',
    name: '硫酸',
    formula: 'H₂SO₄',
    category: HazardCategory.CORROSIVE,
    corrosiveSubType: CorrosiveSubType.ACID,
    icon: '🧪',
    hazardLevel: 4,
    storageRequirements: {
      minTemp: 0,
      maxTemp: 35,
      maxHumidity: 80,
      isolationDistance: 0
    },
    description: '无色油状液体，强腐蚀性，与水剧烈反应放热，与碱剧烈中和。'
  },
  {
    id: 'hcl',
    name: '盐酸',
    formula: 'HCl',
    category: HazardCategory.CORROSIVE,
    corrosiveSubType: CorrosiveSubType.ACID,
    icon: '🧪',
    hazardLevel: 3,
    storageRequirements: {
      minTemp: -15,
      maxTemp: 30,
      maxHumidity: 85,
      isolationDistance: 0
    },
    description: '无色透明液体，有刺激性气味，强腐蚀性，能与碱剧烈反应。'
  },
  {
    id: 'naoh',
    name: '氢氧化钠',
    formula: 'NaOH',
    category: HazardCategory.CORROSIVE,
    corrosiveSubType: CorrosiveSubType.ALKALI,
    icon: '🧪',
    hazardLevel: 4,
    storageRequirements: {
      minTemp: 0,
      maxTemp: 35,
      maxHumidity: 60,
      isolationDistance: 0
    },
    description: '白色固体，强碱，强腐蚀性，易潮解，与酸剧烈中和放热。'
  },
  {
    id: 'ca_oh_2',
    name: '氢氧化钙',
    formula: 'Ca(OH)₂',
    category: HazardCategory.CORROSIVE,
    corrosiveSubType: CorrosiveSubType.ALKALI,
    icon: '🧪',
    hazardLevel: 3,
    storageRequirements: {
      minTemp: 0,
      maxTemp: 40,
      maxHumidity: 70,
      isolationDistance: 0
    },
    description: '白色粉末，中等强度碱，有腐蚀性，与酸反应。'
  },
  {
    id: 'nh3',
    name: '液氨',
    formula: 'NH₃',
    category: HazardCategory.COMPRESSED_GAS,
    icon: '💨',
    hazardLevel: 4,
    storageRequirements: {
      minTemp: -33,
      maxTemp: 30,
      maxHumidity: 80,
      isolationDistance: 1
    },
    specialZones: ['refrigerated'],
    description: '无色液体，有强烈刺激性气味，受热压力升高可爆炸。'
  },
  {
    id: 'lpg',
    name: '液化石油气',
    formula: 'C₃-C₄',
    category: HazardCategory.COMPRESSED_GAS,
    icon: '💨',
    hazardLevel: 5,
    storageRequirements: {
      minTemp: -40,
      maxTemp: 40,
      maxHumidity: 80,
      isolationDistance: 1
    },
    description: '无色气体，易燃易爆，与空气混合可形成爆炸性混合物。'
  },
  {
    id: 'co2',
    name: '二氧化碳',
    formula: 'CO₂',
    category: HazardCategory.COMPRESSED_GAS,
    icon: '💨',
    hazardLevel: 2,
    storageRequirements: {
      minTemp: -30,
      maxTemp: 45,
      maxHumidity: 85,
      isolationDistance: 0
    },
    description: '无色无味气体，不可燃，高压储存，受热压力升高。'
  }
];

export const getChemicalById = (id: string): Chemical | undefined => {
  return CHEMICALS.find(c => c.id === id);
};
