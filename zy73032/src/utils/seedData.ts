import type {
  Pet,
  PetAlias,
  DataSource,
  Schedule,
  MedicalRecord,
  OperationLog,
} from "@/types";

export interface SeedData {
  pets: Pet[];
  aliases: PetAlias[];
  dataSources: DataSource[];
  schedules: Schedule[];
  medicalRecords: MedicalRecord[];
  operationLogs: OperationLog[];
}

const now = Date.now();
const d = (offsetDay: number, hh = 9, mm = 0) =>
  new Date(2026, 5, 1 + offsetDay, hh, mm).toISOString();
const dateStr = (offsetDay: number) => d(offsetDay).slice(0, 10);

export function buildSeedData(): SeedData {
  const pets: Pet[] = [
    {
      id: "P001",
      canonicalName: "小黄",
      species: "狗",
      gender: "公",
      notes: "中华田园犬，性格温顺，对声音敏感",
      createdAt: d(-30).slice(0, 10),
    },
    {
      id: "P002",
      canonicalName: "阿黑",
      species: "狗",
      gender: "母",
      notes: "拉布拉多混血，刚做完驱虫",
      createdAt: d(-25).slice(0, 10),
    },
  ];

  const aliases: PetAlias[] = [
    {
      id: "A001",
      petId: "P001",
      aliasName: "小黄",
      source: "MANUAL",
      createdAt: d(-30).slice(0, 10),
    },
    {
      id: "A002",
      petId: "P001",
      aliasName: "黄黄",
      source: "MEDICAL_FORM",
      createdAt: d(-3).slice(0, 10),
    },
    {
      id: "A003",
      petId: "P002",
      aliasName: "阿黑",
      source: "MANUAL",
      createdAt: d(-25).slice(0, 10),
    },
  ];

  const dataSources: DataSource[] = [
    {
      id: "SRC-CSV-001",
      type: "CSV",
      fileName: "2026年6月上旬训练课排程.csv",
      importedBy: "小乔",
      importedAt: d(-2),
      note: "救助站训练组每周导出一次",
    },
    {
      id: "SRC-MED-001",
      type: "MEDICAL_FORM",
      fileName: "病历手写单-第3周（小乔录入）",
      importedBy: "小乔",
      importedAt: d(-1),
      note: "附带一条正常记录样例",
    },
  ];

  const beforeSchedule001 = {
    petName: "小黄",
    petId: null,
    courseName: "基础服从课",
    courseDate: dateStr(0),
    durationMin: 60,
    trainer: "王教练",
    status: "PENDING",
  };
  const afterSchedule001 = {
    ...beforeSchedule001,
    petId: "P001",
    status: "CONFIRMED",
    confirmedBy: "小乔",
    confirmedAt: d(0, 16, 30),
  };

  const schedules: Schedule[] = [
    {
      id: "SCH-001",
      ...afterSchedule001,
      sourceId: "SRC-CSV-001",
      sourceRow: "CSV第2行",
    } as Schedule,
    {
      id: "SCH-002",
      petName: "阿黑",
      petId: null,
      courseName: "社交适应课",
      courseDate: dateStr(1),
      durationMin: 45,
      trainer: "李教练",
      status: "PENDING",
      sourceId: "SRC-CSV-001",
      sourceRow: "CSV第3行",
    },
    {
      id: "SCH-003",
      petName: "黄黄",
      petId: null,
      courseName: "基础服从课(复训)",
      courseDate: dateStr(2),
      durationMin: 60,
      trainer: "王教练",
      status: "PENDING",
      sourceId: "SRC-MED-001",
      sourceRow: "手写单-第1条",
    },
    {
      id: "SCH-004",
      petName: "黑妞",
      petId: null,
      courseName: "唤回训练",
      courseDate: dateStr(3),
      durationMin: 30,
      trainer: "王教练",
      status: "ANOMALY",
      sourceId: "SRC-CSV-001",
      sourceRow: "CSV第4行",
      anomalyReason: "宠物别名未绑定或存在冲突，已隔离出汇总",
    },
  ];

  const medicalRecords: MedicalRecord[] = [
    {
      id: "MED-001",
      petName: "黄黄",
      visitDate: dateStr(2),
      diagnosis: "皮肤常规检查，少量皮屑",
      treatment: "外用抗真菌喷剂，每周2次",
      veterinarian: "陈医生",
      sourceId: "SRC-MED-001",
      linkedScheduleId: "SCH-003",
      createdAt: d(2, 11, 20),
    },
    {
      id: "MED-002",
      petName: "黑妞",
      visitDate: dateStr(3),
      diagnosis: "年度疫苗接种（狂犬+四联）",
      treatment: "观察30分钟无异常后离院",
      veterinarian: "林医生",
      sourceId: "SRC-MED-001",
      linkedScheduleId: null,
      createdAt: d(3, 10, 5),
    },
  ];

  const operationLogs: OperationLog[] = [
    {
      id: "LOG-001",
      targetType: "SCHEDULE",
      targetId: "SCH-001",
      action: "CONFIRM",
      operator: "小乔",
      operatedAt: d(0, 16, 30),
      beforeState: beforeSchedule001 as unknown as Record<string, unknown>,
      afterState: afterSchedule001 as unknown as Record<string, unknown>,
      remark: "规范名与排程名一致，直接确认",
    },
    {
      id: "LOG-002",
      targetType: "SOURCE",
      targetId: "SRC-CSV-001",
      action: "IMPORT_CSV",
      operator: "小乔",
      operatedAt: d(-2),
      beforeState: null,
      afterState: { fileName: "2026年6月上旬训练课排程.csv", records: 3 } as Record<
        string,
        unknown
      >,
      remark: "首次导入，共3行训练课记录",
    },
    {
      id: "LOG-003",
      targetType: "SOURCE",
      targetId: "SRC-MED-001",
      action: "IMPORT_MEDICAL",
      operator: "小乔",
      operatedAt: d(-1),
      beforeState: null,
      afterState: { fileName: "病历手写单-第3周", records: 2 } as Record<string, unknown>,
      remark:
        "MED-001 为正常记录（已关联排程）；MED-002 别名「黑妞」未绑定，进入异常区",
    },
  ];

  return { pets, aliases, dataSources, schedules, medicalRecords, operationLogs };
}

export function getSeededAt(): number {
  return now;
}
