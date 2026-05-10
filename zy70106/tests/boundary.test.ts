import "reflect-metadata";
import { TestDataSource } from "../src/config/test-database";
import { VaccinationService } from "../src/services/VaccinationService";
import { SupplementaryService } from "../src/services/SupplementaryService";
import { ReportService } from "../src/services/ReportService";

describe("边界条件测试", () => {
  let vaccinationService: VaccinationService;
  let supplementaryService: SupplementaryService;
  let reportService: ReportService;

  beforeAll(async () => {
    await TestDataSource.initialize();
    vaccinationService = new VaccinationService(TestDataSource);
    supplementaryService = new SupplementaryService(TestDataSource);
    reportService = new ReportService(TestDataSource);
  });

  afterAll(async () => {
    await TestDataSource.destroy();
  });

  test("创建栏舍：动物数量为负数应抛出异常", async () => {
    await expect(
      vaccinationService.createPen({
        name: "异常栏舍",
        status: "active",
        animalType: "猪",
        animalCount: -10,
      })
    ).rejects.toThrow("动物数量不能为负数");
  });

  test("创建栏舍：名称为空应抛出异常", async () => {
    await expect(
      vaccinationService.createPen({
        name: "",
        status: "active",
        animalType: "猪",
        animalCount: 100,
      })
    ).rejects.toThrow("栏舍名称不能为空");
  });

  test("创建计划：目标动物数量超过栏舍总数应抛出异常", async () => {
    const pen = await vaccinationService.createPen({
      name: "栏舍E",
      status: "active",
      animalType: "猪",
      animalCount: 50,
    });

    await expect(
      vaccinationService.createPlan({
        name: "测试计划",
        vaccineName: "猪瘟疫苗",
        scheduledDate: new Date("2026-05-30"),
        targetAnimalCount: 100,
        penId: pen.id,
      })
    ).rejects.toThrow("目标动物数量不能超过栏舍总动物数");
  });

  test("创建计划：已停用的栏舍应抛出异常", async () => {
    const pen = await vaccinationService.createPen({
      name: "停用栏舍",
      status: "inactive",
      animalType: "猪",
      animalCount: 100,
    });

    await expect(
      vaccinationService.createPlan({
        name: "测试计划",
        vaccineName: "猪瘟疫苗",
        scheduledDate: new Date("2026-05-30"),
        targetAnimalCount: 50,
        penId: pen.id,
      })
    ).rejects.toThrow("栏舍已停用");
  });

  test("创建兽医：执业证号重复应抛出异常", async () => {
    await vaccinationService.createVeterinarian({
      name: "医生A",
      licenseNumber: "DUP-LIC-001",
      phone: "13800138101",
    });

    await expect(
      vaccinationService.createVeterinarian({
        name: "医生B",
        licenseNumber: "DUP-LIC-001",
        phone: "13800138102",
      })
    ).rejects.toThrow("执业证号已存在");
  });

  test("创建批次：有效期早于生产日期应抛出异常", async () => {
    const pen = await vaccinationService.createPen({
      name: "栏舍F",
      status: "active",
      animalType: "猪",
      animalCount: 100,
    });

    const plan = await vaccinationService.createPlan({
      name: "测试计划",
      vaccineName: "猪瘟疫苗",
      scheduledDate: new Date("2026-05-30"),
      targetAnimalCount: 100,
      penId: pen.id,
    });

    await expect(
      vaccinationService.createBatch({
        batchNumber: "BAD-BATCH-001",
        vaccineName: "猪瘟疫苗",
        manufacturer: "某厂",
        productionDate: new Date("2026-06-01"),
        expiryDate: new Date("2026-01-01"),
        quantity: 100,
        planId: plan.id,
      })
    ).rejects.toThrow("有效期必须晚于生产日期");
  });

  test("创建批次：批次号重复应抛出异常", async () => {
    const pen = await vaccinationService.createPen({
      name: "栏舍G",
      status: "active",
      animalType: "猪",
      animalCount: 100,
    });

    const plan = await vaccinationService.createPlan({
      name: "测试计划",
      vaccineName: "猪瘟疫苗",
      scheduledDate: new Date("2026-05-30"),
      targetAnimalCount: 100,
      penId: pen.id,
    });

    await vaccinationService.createBatch({
      batchNumber: "DUP-BATCH-001",
      vaccineName: "猪瘟疫苗",
      manufacturer: "某厂",
      productionDate: new Date("2026-01-01"),
      expiryDate: new Date("2027-01-01"),
      quantity: 100,
      planId: plan.id,
    });

    await expect(
      vaccinationService.createBatch({
        batchNumber: "DUP-BATCH-001",
        vaccineName: "猪瘟疫苗",
        manufacturer: "其他厂",
        productionDate: new Date("2026-02-01"),
        expiryDate: new Date("2027-02-01"),
        quantity: 100,
        planId: plan.id,
      })
    ).rejects.toThrow("批次号已存在");
  });

  test("创建接种记录：使用过期疫苗应抛出异常", async () => {
    const pen = await vaccinationService.createPen({
      name: "栏舍H",
      status: "active",
      animalType: "猪",
      animalCount: 100,
    });

    const plan = await vaccinationService.createPlan({
      name: "测试计划",
      vaccineName: "猪瘟疫苗",
      scheduledDate: new Date("2026-05-30"),
      targetAnimalCount: 100,
      penId: pen.id,
    });

    const vet = await vaccinationService.createVeterinarian({
      name: "测试医生",
      licenseNumber: "TEST-VET-001",
      phone: "13800138201",
    });

    const batch = await vaccinationService.createBatch({
      batchNumber: "EXPIRED-BATCH-001",
      vaccineName: "猪瘟疫苗",
      manufacturer: "某厂",
      productionDate: new Date("2025-01-01"),
      expiryDate: new Date("2025-12-31"),
      quantity: 100,
      planId: plan.id,
    });

    await expect(
      vaccinationService.createVaccinationRecord({
        vaccinationDate: new Date("2026-05-30"),
        animalCount: 100,
        penId: pen.id,
        planId: plan.id,
        veterinarianId: vet.id,
        batchId: batch.id,
      })
    ).rejects.toThrow("疫苗已过期");
  });

  test("创建接种记录：疫苗数量不足应抛出异常", async () => {
    const pen = await vaccinationService.createPen({
      name: "栏舍I",
      status: "active",
      animalType: "猪",
      animalCount: 200,
    });

    const plan = await vaccinationService.createPlan({
      name: "测试计划",
      vaccineName: "猪瘟疫苗",
      scheduledDate: new Date("2026-05-30"),
      targetAnimalCount: 200,
      penId: pen.id,
    });

    const vet = await vaccinationService.createVeterinarian({
      name: "测试医生",
      licenseNumber: "TEST-VET-002",
      phone: "13800138202",
    });

    const batch = await vaccinationService.createBatch({
      batchNumber: "SHORT-BATCH-001",
      vaccineName: "猪瘟疫苗",
      manufacturer: "某厂",
      productionDate: new Date("2026-01-01"),
      expiryDate: new Date("2027-01-01"),
      quantity: 100,
      planId: plan.id,
    });

    await expect(
      vaccinationService.createVaccinationRecord({
        vaccinationDate: new Date("2026-05-30"),
        animalCount: 150,
        penId: pen.id,
        planId: plan.id,
        veterinarianId: vet.id,
        batchId: batch.id,
      })
    ).rejects.toThrow("疫苗数量不足");
  });

  test("确认记录：非本人记录应抛出异常", async () => {
    const pen = await vaccinationService.createPen({
      name: "栏舍J",
      status: "active",
      animalType: "猪",
      animalCount: 100,
    });

    const plan = await vaccinationService.createPlan({
      name: "测试计划",
      vaccineName: "猪瘟疫苗",
      scheduledDate: new Date("2026-05-30"),
      targetAnimalCount: 100,
      penId: pen.id,
    });

    const vet1 = await vaccinationService.createVeterinarian({
      name: "医生1",
      licenseNumber: "TEST-VET-003",
      phone: "13800138203",
    });

    const vet2 = await vaccinationService.createVeterinarian({
      name: "医生2",
      licenseNumber: "TEST-VET-004",
      phone: "13800138204",
    });

    const batch = await vaccinationService.createBatch({
      batchNumber: "CONFIRM-BATCH-001",
      vaccineName: "猪瘟疫苗",
      manufacturer: "某厂",
      productionDate: new Date("2026-01-01"),
      expiryDate: new Date("2027-01-01"),
      quantity: 100,
      planId: plan.id,
    });

    const record = await vaccinationService.createVaccinationRecord({
      vaccinationDate: new Date("2026-05-30"),
      animalCount: 100,
      penId: pen.id,
      planId: plan.id,
      veterinarianId: vet1.id,
      batchId: batch.id,
    });

    await expect(
      vaccinationService.confirmRecord(record.id, vet2.id)
    ).rejects.toThrow("只能确认自己的接种记录");
  });

  test("拒绝记录：无拒绝原因应抛出异常", async () => {
    const pen = await vaccinationService.createPen({
      name: "栏舍K",
      status: "active",
      animalType: "猪",
      animalCount: 100,
    });

    const plan = await vaccinationService.createPlan({
      name: "测试计划",
      vaccineName: "猪瘟疫苗",
      scheduledDate: new Date("2026-05-30"),
      targetAnimalCount: 100,
      penId: pen.id,
    });

    const vet = await vaccinationService.createVeterinarian({
      name: "测试医生",
      licenseNumber: "TEST-VET-005",
      phone: "13800138205",
    });

    const batch = await vaccinationService.createBatch({
      batchNumber: "REJECT-BATCH-001",
      vaccineName: "猪瘟疫苗",
      manufacturer: "某厂",
      productionDate: new Date("2026-01-01"),
      expiryDate: new Date("2027-01-01"),
      quantity: 100,
      planId: plan.id,
    });

    const record = await vaccinationService.createVaccinationRecord({
      vaccinationDate: new Date("2026-05-30"),
      animalCount: 100,
      penId: pen.id,
      planId: plan.id,
      veterinarianId: vet.id,
      batchId: batch.id,
    });

    await expect(
      vaccinationService.rejectRecord(record.id, "")
    ).rejects.toThrow("拒绝原因不能为空");
  });

  test("生成报表：结束日期早于开始日期应抛出异常", async () => {
    const pen = await vaccinationService.createPen({
      name: "栏舍L",
      status: "active",
      animalType: "猪",
      animalCount: 100,
    });

    await expect(
      reportService.generateQuarantineReport({
        reportPeriodStart: new Date("2026-05-30"),
        reportPeriodEnd: new Date("2026-05-01"),
        penIds: [pen.id],
        generatedBy: "测试员",
      })
    ).rejects.toThrow("结束日期不能早于起始日期");
  });

  test("生成报表：未选择栏舍应抛出异常", async () => {
    await expect(
      reportService.generateQuarantineReport({
        reportPeriodStart: new Date("2026-05-01"),
        reportPeriodEnd: new Date("2026-05-30"),
        penIds: [],
        generatedBy: "测试员",
      })
    ).rejects.toThrow("至少选择一个栏舍");
  });
});
