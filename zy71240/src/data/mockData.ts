import type {
  InsuranceCase,
  PartCard,
  RepairPrice,
  PolicyRule,
  CustomerMood,
  StandardAnswer,
  ClueItem,
} from "@/types"

export const CASES: InsuranceCase[] = [
  {
    id: "case-001",
    caseNumber: "BX-2026-0418",
    accidentDate: "2026-04-18",
    carModel: "丰田卡罗拉 2024款",
    insuranceType: "车辆损失险+第三者责任险",
    photoUrl: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=front%20car%20damage%20accident%20bumper%20fender%20crumpled%20headlight%20broken%20realistic%20photo&image_size=landscape_16_9",
    description: "十字路口追尾事故，前车急刹导致碰撞，车辆前部受损",
  },
  {
    id: "case-002",
    caseNumber: "BX-2026-0425",
    accidentDate: "2026-04-25",
    carModel: "本田思域 2023款",
    insuranceType: "车辆损失险+不计免赔",
    photoUrl: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=side%20car%20damage%20door%20scratched%20dented%20realistic%20photo%20parking%20lot&image_size=landscape_16_9",
    description: "停车场侧方被刮蹭，左前门和左后门受损，疑似含旧伤",
  },
  {
    id: "case-003",
    caseNumber: "BX-2026-0502",
    accidentDate: "2026-05-02",
    carModel: "大众帕萨特 2025款",
    insuranceType: "车辆损失险+第三者责任险+划痕险",
    photoUrl: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=rear%20car%20damage%20trunk%20bumper%20collision%20tail%20light%20broken%20realistic%20photo&image_size=landscape_16_9",
    description: "高速被追尾，后保险杠变形、尾灯破裂，尾箱盖无法正常关闭",
  },
]

export const PART_CARDS: Record<string, PartCard[]> = {
  "case-001": [
    {
      id: "pc-001-1",
      caseId: "case-001",
      partName: "前保险杠",
      damageDescription: "前保险杠右侧明显凹陷，表面有擦痕，约15cm裂口",
      hasOldDamage: false,
      oldDamageDetail: "",
    },
    {
      id: "pc-001-2",
      caseId: "case-001",
      partName: "右前翼子板",
      damageDescription: "右前翼子板变形翘起，漆面大面积剥落",
      hasOldDamage: true,
      oldDamageDetail: "翼子板根部有锈蚀痕迹，表明此前已有碰撞修复历史，旧伤占比约30%",
    },
    {
      id: "pc-001-3",
      caseId: "case-001",
      partName: "右前大灯",
      damageDescription: "右前大灯灯罩碎裂，灯体固定点断裂",
      hasOldDamage: false,
      oldDamageDetail: "",
    },
    {
      id: "pc-001-4",
      caseId: "case-001",
      partName: "引擎盖",
      damageDescription: "引擎盖前端轻微翘起，锁扣可正常闭合",
      hasOldDamage: true,
      oldDamageDetail: "引擎盖中部有约8cm旧划痕，与本次事故无关",
    },
    {
      id: "pc-001-5",
      caseId: "case-001",
      partName: "水箱框架",
      damageDescription: "水箱框架未见明显变形",
      hasOldDamage: false,
      oldDamageDetail: "",
    },
  ],
  "case-002": [
    {
      id: "pc-002-1",
      caseId: "case-002",
      partName: "左前门",
      damageDescription: "左前门中部门把手附近有明显凹痕，约20cm刮擦",
      hasOldDamage: true,
      oldDamageDetail: "门把手上方有旧漆面修复痕迹（色差明显），旧伤占该部位40%",
    },
    {
      id: "pc-002-2",
      caseId: "case-002",
      partName: "左后门",
      damageDescription: "左后门全门长刮擦，底漆暴露",
      hasOldDamage: false,
      oldDamageDetail: "",
    },
    {
      id: "pc-002-3",
      caseId: "case-002",
      partName: "左前翼子板",
      damageDescription: "左前翼子板后端轻微刮擦",
      hasOldDamage: true,
      oldDamageDetail: "翼子板前端有旧锈蚀点，与本次刮擦方向不一致",
    },
    {
      id: "pc-002-4",
      caseId: "case-002",
      partName: "左侧B柱",
      damageDescription: "B柱表面未见明显损伤",
      hasOldDamage: false,
      oldDamageDetail: "",
    },
  ],
  "case-003": [
    {
      id: "pc-003-1",
      caseId: "case-003",
      partName: "后保险杠",
      damageDescription: "后保险杠整体内凹，右侧约10cm裂口",
      hasOldDamage: false,
      oldDamageDetail: "",
    },
    {
      id: "pc-003-2",
      caseId: "case-003",
      partName: "左后尾灯",
      damageDescription: "左后尾灯灯罩碎裂，灯泡完好",
      hasOldDamage: false,
      oldDamageDetail: "",
    },
    {
      id: "pc-003-3",
      caseId: "case-003",
      partName: "尾箱盖",
      damageDescription: "尾箱盖下沿变形，影响闭合",
      hasOldDamage: true,
      oldDamageDetail: "尾箱盖上沿有旧钣金修复痕迹，漆面厚度不均",
    },
    {
      id: "pc-003-4",
      caseId: "case-003",
      partName: "后围板",
      damageDescription: "后围板轻微变形",
      hasOldDamage: false,
      oldDamageDetail: "",
    },
    {
      id: "pc-003-5",
      caseId: "case-003",
      partName: "右后翼子板",
      damageDescription: "右后翼子板与保险杠接缝处变形",
      hasOldDamage: false,
      oldDamageDetail: "",
    },
  ],
}

export const REPAIR_PRICES: Record<string, RepairPrice[]> = {
  "case-001": [
    { id: "rp-001-1", caseId: "case-001", partName: "前保险杠", minorPrice: 800, moderatePrice: 2200, severePrice: 4500, totalLossPrice: 0, priceConfused: false, confusedDetail: "" },
    { id: "rp-001-2", caseId: "case-001", partName: "右前翼子板", minorPrice: 600, moderatePrice: 1800, severePrice: 3800, totalLossPrice: 0, priceConfused: true, confusedDetail: "旧伤修复费用应从赔付中扣除，翼子板旧伤占比30%，实际新伤赔付应乘以0.7" },
    { id: "rp-001-3", caseId: "case-001", partName: "右前大灯", minorPrice: 0, moderatePrice: 1200, severePrice: 3500, totalLossPrice: 0, priceConfused: false, confusedDetail: "" },
    { id: "rp-001-4", caseId: "case-001", partName: "引擎盖", minorPrice: 500, moderatePrice: 1500, severePrice: 3200, totalLossPrice: 0, priceConfused: true, confusedDetail: "中部旧划痕不应计入本次赔付" },
    { id: "rp-001-5", caseId: "case-001", partName: "水箱框架", minorPrice: 400, moderatePrice: 1200, severePrice: 2800, totalLossPrice: 0, priceConfused: false, confusedDetail: "" },
  ],
  "case-002": [
    { id: "rp-002-1", caseId: "case-002", partName: "左前门", minorPrice: 700, moderatePrice: 2000, severePrice: 4200, totalLossPrice: 0, priceConfused: true, confusedDetail: "旧漆修复占该门40%面积，实际新伤赔付应乘以0.6" },
    { id: "rp-002-2", caseId: "case-002", partName: "左后门", minorPrice: 700, moderatePrice: 2000, severePrice: 4200, totalLossPrice: 0, priceConfused: false, confusedDetail: "" },
    { id: "rp-002-3", caseId: "case-002", partName: "左前翼子板", minorPrice: 500, moderatePrice: 1600, severePrice: 3500, totalLossPrice: 0, priceConfused: true, confusedDetail: "前端旧锈蚀不应计入赔付" },
    { id: "rp-002-4", caseId: "case-002", partName: "左侧B柱", minorPrice: 600, moderatePrice: 1800, severePrice: 3800, totalLossPrice: 0, priceConfused: false, confusedDetail: "" },
  ],
  "case-003": [
    { id: "rp-003-1", caseId: "case-003", partName: "后保险杠", minorPrice: 800, moderatePrice: 2200, severePrice: 4500, totalLossPrice: 0, priceConfused: false, confusedDetail: "" },
    { id: "rp-003-2", caseId: "case-003", partName: "左后尾灯", minorPrice: 0, moderatePrice: 1000, severePrice: 2800, totalLossPrice: 0, priceConfused: false, confusedDetail: "" },
    { id: "rp-003-3", caseId: "case-003", partName: "尾箱盖", minorPrice: 600, moderatePrice: 1800, severePrice: 3800, totalLossPrice: 0, priceConfused: true, confusedDetail: "上沿旧钣金修复不应计入本次赔付" },
    { id: "rp-003-4", caseId: "case-003", partName: "后围板", minorPrice: 500, moderatePrice: 1400, severePrice: 3000, totalLossPrice: 0, priceConfused: false, confusedDetail: "" },
    { id: "rp-003-5", caseId: "case-003", partName: "右后翼子板", minorPrice: 500, moderatePrice: 1600, severePrice: 3500, totalLossPrice: 0, priceConfused: false, confusedDetail: "" },
  ],
}

export const POLICY_RULES: Record<string, PolicyRule[]> = {
  "case-001": [
    {
      id: "pr-001-1", caseId: "case-001", clauseType: "限额条款",
      clauseContent: "车辆损失险每次事故绝对免赔额2000元，超出部分按80%赔付",
      isExemption: false, coverageLimit: 50000, specialTerms: "无",
      relatedParts: ["前保险杠", "右前翼子板", "右前大灯", "引擎盖"],
    },
    {
      id: "pr-001-2", caseId: "case-001", clauseType: "免责条款",
      clauseContent: "被保险车辆 pre-existing 旧伤不属于保险责任范围，定损时应扣除旧伤修复费用",
      isExemption: true, coverageLimit: 0, specialTerms: "旧伤需由定损员判断并扣除",
      relatedParts: ["右前翼子板", "引擎盖"],
    },
    {
      id: "pr-001-3", caseId: "case-001", clauseType: "特约条款",
      clauseContent: "不计免赔率特约条款：免除免赔率，但不免除免赔额",
      isExemption: false, coverageLimit: 0, specialTerms: "仅免除免赔率",
      relatedParts: [],
    },
  ],
  "case-002": [
    {
      id: "pr-002-1", caseId: "case-002", clauseType: "限额条款",
      clauseContent: "车辆损失险每次事故最高赔付限额30000元",
      isExemption: false, coverageLimit: 30000, specialTerms: "无",
      relatedParts: ["左前门", "左后门", "左前翼子板"],
    },
    {
      id: "pr-002-2", caseId: "case-002", clauseType: "免责条款",
      clauseContent: "划痕险仅承保无明显碰撞痕迹的单独划痕，碰撞导致的划痕不属于划痕险责任",
      isExemption: true, coverageLimit: 0, specialTerms: "碰撞划痕不属于划痕险",
      relatedParts: ["左前门", "左后门", "左前翼子板"],
    },
    {
      id: "pr-002-3", caseId: "case-002", clauseType: "免责条款",
      clauseContent: "旧伤修复费用不予赔付，定损员应区分新旧损伤",
      isExemption: true, coverageLimit: 0, specialTerms: "需对比漆面色差和锈蚀程度判断",
      relatedParts: ["左前门", "左前翼子板"],
    },
  ],
  "case-003": [
    {
      id: "pr-003-1", caseId: "case-003", clauseType: "限额条款",
      clauseContent: "车辆损失险每次事故绝对免赔额1500元，超出部分全额赔付",
      isExemption: false, coverageLimit: 80000, specialTerms: "无",
      relatedParts: ["后保险杠", "左后尾灯", "尾箱盖", "后围板", "右后翼子板"],
    },
    {
      id: "pr-003-2", caseId: "case-003", clauseType: "免责条款",
      clauseContent: "追尾事故中后车负全责时，被追尾方车辆损失由后车保险公司承担",
      isExemption: true, coverageLimit: 0, specialTerms: "本车为被追尾方",
      relatedParts: [],
    },
    {
      id: "pr-003-3", caseId: "case-003", clauseType: "特约条款",
      clauseContent: "涉水险附加条款：本车未投保涉水险，发动机进水损失不赔付",
      isExemption: false, coverageLimit: 0, specialTerms: "发动机进水不在保障范围",
      relatedParts: [],
    },
  ],
}

export const CUSTOMER_MOODS: Record<string, CustomerMood> = {
  "case-001": {
    id: "cm-001", caseId: "case-001", moodType: "急躁",
    behaviorDescription: "客户情绪激动，反复催促尽快定损，声称所有损伤都是本次事故造成",
    credibilityScore: 60,
    hiddenInfo: "客户在翼子板旧伤问题上含糊其辞，试图将旧伤也算入本次定损",
  },
  "case-002": {
    id: "cm-002", caseId: "case-002", moodType: "隐瞒",
    behaviorDescription: "客户态度配合但回避旧伤话题，声称从未修过车",
    credibilityScore: 40,
    hiddenInfo: "左前门有明显旧修复痕迹（色差），客户否认此前有过事故维修",
  },
  "case-003": {
    id: "cm-003", caseId: "case-003", moodType: "配合",
    behaviorDescription: "客户态度平和，如实说明事故经过，主动指出尾箱盖之前修过",
    credibilityScore: 90,
    hiddenInfo: "客户主动告知的旧伤信息与实际检查一致，可信度高",
  },
}

export const STANDARD_ANSWERS: Record<string, StandardAnswer> = {
  "case-001": {
    id: "sa-001", caseId: "case-001",
    damagedParts: ["前保险杠", "右前翼子板", "右前大灯", "引擎盖"],
    partGrades: [
      { partName: "前保险杠", grade: "中度" },
      { partName: "右前翼子板", grade: "重度" },
      { partName: "右前大灯", grade: "重度" },
      { partName: "引擎盖", grade: "轻微" },
    ],
    riskLevel: "中",
    correctPayout: 7600,
    keyClues: ["pc-001-2", "pr-001-2"],
    exemptionClauses: ["pr-001-2"],
  },
  "case-002": {
    id: "sa-002", caseId: "case-002",
    damagedParts: ["左前门", "左后门", "左前翼子板"],
    partGrades: [
      { partName: "左前门", grade: "中度" },
      { partName: "左后门", grade: "中度" },
      { partName: "左前翼子板", grade: "轻微" },
    ],
    riskLevel: "高",
    correctPayout: 2860,
    keyClues: ["pc-002-1", "pr-002-2", "pr-002-3"],
    exemptionClauses: ["pr-002-2", "pr-002-3"],
  },
  "case-003": {
    id: "sa-003", caseId: "case-003",
    damagedParts: ["后保险杠", "左后尾灯", "尾箱盖", "后围板", "右后翼子板"],
    partGrades: [
      { partName: "后保险杠", grade: "重度" },
      { partName: "左后尾灯", grade: "重度" },
      { partName: "尾箱盖", grade: "中度" },
      { partName: "后围板", grade: "轻微" },
      { partName: "右后翼子板", grade: "轻微" },
    ],
    riskLevel: "低",
    correctPayout: 12300,
    keyClues: ["pr-003-2"],
    exemptionClauses: ["pr-003-2"],
  },
}

export function buildClueItems(caseId: string): ClueItem[] {
  const parts = PART_CARDS[caseId] || []
  const prices = REPAIR_PRICES[caseId] || []
  const rules = POLICY_RULES[caseId] || []
  const mood = CUSTOMER_MOODS[caseId]

  const items: ClueItem[] = []

  parts.forEach((p) => {
    items.push({
      id: p.id,
      type: "部位卡",
      title: p.partName,
      description: p.damageDescription,
      data: p,
    })
  })

  prices.forEach((p) => {
    items.push({
      id: p.id,
      type: "维修价目",
      title: `${p.partName} 维修价目`,
      description: `轻微: ¥${p.minorPrice} | 中度: ¥${p.moderatePrice} | 重度: ¥${p.severePrice}${p.totalLossPrice > 0 ? ` | 报废: ¥${p.totalLossPrice}` : ""}`,
      data: p,
    })
  })

  rules.forEach((r) => {
    items.push({
      id: r.id,
      type: "保单条款",
      title: `${r.clauseType}${r.isExemption ? "（免责）" : ""}`,
      description: r.clauseContent,
      data: r,
    })
  })

  if (mood) {
    items.push({
      id: mood.id,
      type: "客户情绪",
      title: `客户情绪：${mood.moodType}`,
      description: mood.behaviorDescription,
      data: mood,
    })
  }

  return items
}
