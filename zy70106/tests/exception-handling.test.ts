import "reflect-metadata";
import { TestDataSource } from "../src/config/test-database";
import { VaccinationService } from "../src/services/VaccinationService";
import { SupplementaryService } from "../src/services/SupplementaryService";
import { TraceabilityService } from "../src/services/TraceabilityService";
import { ReportService } from "../src/services/ReportService";

describe("异常处理测试", () => {
  let vaccinationService: VaccinationService;
  let supplementaryService: SupplementaryService;
  let traceabilityService: TraceabilityService;
  let reportService: ReportService;

  beforeAll(async () => {
    await TestDataSource.initialize();
    vaccinationService = new VaccinationService(TestDataSource);
    supplementaryService = new SupplementaryService(TestDataSource);
    traceabilityService = new TraceabilityService(TestDataSource);
    reportService = new ReportService(TestDataSource);
  });

  afterAll(async () => {
    await TestDataSource.destroy();
  });

  test("查询不存在的栏舍应抛出异常", async () => {
    await expect(
      vaccinationService.createPlan({
        name: "测试计划",
        vaccineName: "猪瘟疫苗",
        scheduledDate: new Date("2026-05-30"),
        targetAnimalCount: 100,
        penId: "non-existent-pen-id",
      })
    ).rejects.toThrow("栏舍不存在");
  });

  test("查询不存在的兽医应抛出异常", async () => {
    const pen = await vaccinationService.createPen({
      name: "栏舍M",
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

    const batch = await vaccinationService.createBatch({
      batchNumber: "EXC-BATCH-001",
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
        animalCount: 100,
        penId: pen.id,
        planId: plan.id,
        veterinarianId: "non-existent-vet-id",
        batchId: batch.id,
      })
    ).rejects.toThrow("兽医不存在");
  });

  test("查询不存在的批次应抛出异常", async () => {
    await expect(
      traceabilityService.traceBatch("non-existent-batch-id")
    ).rejects.toThrow("疫苗批次不存在");
  });

  test("查询不存在的记录历史应抛出异常", async () => {
    await expect(
      vaccinationService.getRecordWithHistory("non-existent-record-id")
    ).rejects.toThrow("接种记录不存在");
  });

  test("确认已确认的记录应抛出异常", async () => {
    const pen = await vaccinationService.createPen({
      name: "栏舍N",
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
      licenseNumber: "EXC-VET-001",
      phone: "13800138301",
    });

    const batch = await vaccinationService.createBatch({
      batchNumber: "EXC-BATCH-002",
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

    await vaccinationService.confirmRecord(record.id, vet.id);

    await expect(
      vaccinationService.confirmRecord(record.id, vet.id)
    ).rejects.toThrow("只能确认待处理的记录");
  });

  test("拒绝已拒绝的记录应抛出异常", async () => {
    const pen = await vaccinationService.createPen({
      name: "栏舍O",
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
      licenseNumber: "EXC-VET-002",
      phone: "13800138302",
    });

    const batch = await vaccinationService.createBatch({
      batchNumber: "EXC-BATCH-003",
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

    await vaccinationService.rejectRecord(record.id, "测试拒绝");

    await expect(
      vaccinationService.rejectRecord(record.id, "再次拒绝")
    ).rejects.toThrow("只能拒绝待处理或需要审核的记录");
  });

  test("对已确认的记录进行补录应抛出异常", async () => {
    const pen = await vaccinationService.createPen({
      name: "栏舍P",
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
      licenseNumber: "EXC-VET-003",
      phone: "13800138303",
    });

    const batch = await vaccinationService.createBatch({
      batchNumber: "EXC-BATCH-004",
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

    await vaccinationService.confirmRecord(record.id, vet.id);

    await expect(
      supplementaryService.submitSupplementary({
        originalRecordId: record.id,
        actualVaccinationDate: new Date("2026-05-29"),
        reasonForSupplementary: "测试补录",
        submittedBy: "测试人员",
      })
    ).rejects.toThrow("只能对被拒绝或需要审核的记录进行补录");
  });

  test("审批不存在的补录记录应抛出异常", async () => {
    await expect(
      supplementaryService.approveSupplementary({
        supplementaryId: "non-existent-supplementary-id",
        reviewedBy: "审核员",
      })
    ).rejects.toThrow("补录记录不存在");
  });

  test("对已审批的补录记录再次审批应抛出异常", async () => {
    const pen = await vaccinationService.createPen({
      name: "栏舍Q",
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
      licenseNumber: "EXC-VET-004",
      phone: "13800138304",
    });

    const batch = await vaccinationService.createBatch({
      batchNumber: "EXC-BATCH-005",
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

    await vaccinationService.rejectRecord(record.id, "测试拒绝");

    const supplementary = await supplementaryService.submitSupplementary({
      originalRecordId: record.id,
      actualVaccinationDate: new Date("2026-05-29"),
      reasonForSupplementary: "测试补录",
      submittedBy: "测试人员",
    });

    await supplementaryService.approveSupplementary({
      supplementaryId: supplementary.id,
      reviewedBy: "审核员",
    });

    await expect(
      supplementaryService.approveSupplementary({
        supplementaryId: supplementary.id,
        reviewedBy: "审核员",
      })
    ).rejects.toThrow("只能审核待处理的补录记录");
  });

  test("提交已提交的报表应抛出异常", async () => {
    const pen = await vaccinationService.createPen({
      name: "栏舍R",
      status: "active",
      animalType: "猪",
      animalCount: 100,
    });

    const report = await reportService.generateQuarantineReport({
      reportPeriodStart: new Date("2026-05-01"),
      reportPeriodEnd: new Date("2026-05-30"),
      penIds: [pen.id],
      generatedBy: "测试员",
    });

    await reportService.submitReport(report.id);

    await expect(
      reportService.submitReport(report.id)
    ).rejects.toThrow("只能提交草稿状态的报告");
  });

  test("审批草稿状态的报表应抛出异常", async () => {
    const pen = await vaccinationService.createPen({
      name: "栏舍S",
      status: "active",
      animalType: "猪",
      animalCount: 100,
    });

    const report = await reportService.generateQuarantineReport({
      reportPeriodStart: new Date("2026-05-01"),
      reportPeriodEnd: new Date("2026-05-30"),
      penIds: [pen.id],
      generatedBy: "测试员",
    });

    await expect(
      reportService.approveReport(report.id, "审核员")
    ).rejects.toThrow("只能审批已提交的报告");
  });
});
