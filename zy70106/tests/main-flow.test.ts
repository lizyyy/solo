import "reflect-metadata";
import { TestDataSource } from "../src/config/test-database";
import { VaccinationService } from "../src/services/VaccinationService";
import { SupplementaryService } from "../src/services/SupplementaryService";
import { TraceabilityService } from "../src/services/TraceabilityService";
import { ReportService } from "../src/services/ReportService";

describe("主流程测试", () => {
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

  test("完整接种流程：创建栏舍→计划→兽医→批次→记录→确认→完成计划", async () => {
    const pen = await vaccinationService.createPen({
      name: "栏舍A",
      status: "active",
      animalType: "猪",
      animalCount: 100,
    });
    expect(pen.name).toBe("栏舍A");
    expect(pen.animalCount).toBe(100);

    const plan = await vaccinationService.createPlan({
      name: "猪瘟疫苗接种计划",
      vaccineName: "猪瘟活疫苗",
      scheduledDate: new Date("2026-05-15"),
      targetAnimalCount: 100,
      penId: pen.id,
    });
    expect(plan.name).toBe("猪瘟疫苗接种计划");
    expect(plan.status).toBe("pending");

    const vet = await vaccinationService.createVeterinarian({
      name: "张医生",
      licenseNumber: "VET001",
      phone: "13800138001",
    });
    expect(vet.name).toBe("张医生");
    expect(vet.licenseNumber).toBe("VET001");

    const batch = await vaccinationService.createBatch({
      batchNumber: "BATCH-2026-001",
      vaccineName: "猪瘟活疫苗",
      manufacturer: "某生物制品厂",
      productionDate: new Date("2026-01-01"),
      expiryDate: new Date("2027-01-01"),
      quantity: 100,
      planId: plan.id,
    });
    expect(batch.batchNumber).toBe("BATCH-2026-001");
    expect(batch.status).toBe("pending");

    const record = await vaccinationService.createVaccinationRecord({
      vaccinationDate: new Date("2026-05-15"),
      animalCount: 100,
      penId: pen.id,
      planId: plan.id,
      veterinarianId: vet.id,
      batchId: batch.id,
    });
    expect(record.status).toBe("pending");
    expect(record.animalCount).toBe(100);

    const confirmedRecord = await vaccinationService.confirmRecord(record.id, vet.id);
    expect(confirmedRecord.status).toBe("confirmed");

    const updatedPlan = await TestDataSource.getRepository("VaccinationPlan").findOne({
      where: { id: plan.id },
    });
    expect(updatedPlan.status).toBe("completed");

    const updatedPen = await TestDataSource.getRepository("Pen").findOne({
      where: { id: pen.id },
    });
    expect(updatedPen.lastVaccinationDate).toBeDefined();
  });

  test("批次追溯功能：创建完整流程后验证追溯信息", async () => {
    const pen = await vaccinationService.createPen({
      name: "栏舍B",
      status: "active",
      animalType: "牛",
      animalCount: 50,
    });

    const plan = await vaccinationService.createPlan({
      name: "口蹄疫疫苗接种计划",
      vaccineName: "口蹄疫灭活疫苗",
      scheduledDate: new Date("2026-05-20"),
      targetAnimalCount: 50,
      penId: pen.id,
    });

    const vet = await vaccinationService.createVeterinarian({
      name: "李医生",
      licenseNumber: "VET002",
      phone: "13800138002",
    });

    const batch = await vaccinationService.createBatch({
      batchNumber: "BATCH-2026-002",
      vaccineName: "口蹄疫灭活疫苗",
      manufacturer: "某生物制品厂",
      productionDate: new Date("2026-02-01"),
      expiryDate: new Date("2027-02-01"),
      quantity: 50,
      planId: plan.id,
    });

    const record = await vaccinationService.createVaccinationRecord({
      vaccinationDate: new Date("2026-05-20"),
      animalCount: 50,
      penId: pen.id,
      planId: plan.id,
      veterinarianId: vet.id,
      batchId: batch.id,
    });

    await vaccinationService.confirmRecord(record.id, vet.id);

    const traceResult = await traceabilityService.traceBatch(batch.id);
    expect(traceResult.batch.id).toBe(batch.id);
    expect(traceResult.plan.id).toBe(plan.id);
    expect(traceResult.pen.id).toBe(pen.id);
    expect(traceResult.records.length).toBe(1);
    expect(traceResult.veterinarians.length).toBe(1);
    expect(traceResult.summary.totalAnimals).toBe(50);
    expect(traceResult.summary.vaccinatedAnimals).toBe(50);
    expect(traceResult.summary.isReadyForQuarantine).toBe(true);
  });

  test("补录审核流程：拒绝记录→提交补录→审核通过", async () => {
    const pen = await vaccinationService.createPen({
      name: "栏舍C",
      status: "active",
      animalType: "鸡",
      animalCount: 500,
    });

    const plan = await vaccinationService.createPlan({
      name: "禽流感疫苗接种计划",
      vaccineName: "禽流感灭活疫苗",
      scheduledDate: new Date("2026-05-25"),
      targetAnimalCount: 500,
      penId: pen.id,
    });

    const vet = await vaccinationService.createVeterinarian({
      name: "王医生",
      licenseNumber: "VET003",
      phone: "13800138003",
    });

    const batch = await vaccinationService.createBatch({
      batchNumber: "BATCH-2026-003",
      vaccineName: "禽流感灭活疫苗",
      manufacturer: "某生物制品厂",
      productionDate: new Date("2026-03-01"),
      expiryDate: new Date("2027-03-01"),
      quantity: 500,
      planId: plan.id,
    });

    const record = await vaccinationService.createVaccinationRecord({
      vaccinationDate: new Date("2026-05-24"),
      animalCount: 500,
      penId: pen.id,
      planId: plan.id,
      veterinarianId: vet.id,
      batchId: batch.id,
    });

    const rejectedRecord = await vaccinationService.rejectRecord(record.id, "接种日期错误");
    expect(rejectedRecord.status).toBe("rejected");
    expect(rejectedRecord.rejectionReason).toBe("接种日期错误");

    const supplementary = await supplementaryService.submitSupplementary({
      originalRecordId: record.id,
      actualVaccinationDate: new Date("2026-05-25"),
      reasonForSupplementary: "系统记录日期错误，实际接种日期为25日",
      submittedBy: "王医生",
    });
    expect(supplementary.status).toBe("pending");

    const approved = await supplementaryService.approveSupplementary({
      supplementaryId: supplementary.id,
      reviewedBy: "审核员",
      reviewComments: "情况属实，予以通过",
    });
    expect(approved.status).toBe("approved");

    const finalRecord = await TestDataSource.getRepository("VaccinationRecord").findOne({
      where: { id: record.id },
    });
    expect(finalRecord.status).toBe("confirmed");
  });

  test("检疫报表生成：创建数据后生成报表", async () => {
    const pen = await vaccinationService.createPen({
      name: "栏舍D",
      status: "active",
      animalType: "羊",
      animalCount: 200,
    });

    const plan = await vaccinationService.createPlan({
      name: "羊痘疫苗接种计划",
      vaccineName: "羊痘活疫苗",
      scheduledDate: new Date("2026-05-10"),
      targetAnimalCount: 200,
      penId: pen.id,
    });

    const vet = await vaccinationService.createVeterinarian({
      name: "赵医生",
      licenseNumber: "VET004",
      phone: "13800138004",
    });

    const batch = await vaccinationService.createBatch({
      batchNumber: "BATCH-2026-004",
      vaccineName: "羊痘活疫苗",
      manufacturer: "某生物制品厂",
      productionDate: new Date("2026-04-01"),
      expiryDate: new Date("2027-04-01"),
      quantity: 200,
      planId: plan.id,
    });

    const record = await vaccinationService.createVaccinationRecord({
      vaccinationDate: new Date("2026-05-10"),
      animalCount: 200,
      penId: pen.id,
      planId: plan.id,
      veterinarianId: vet.id,
      batchId: batch.id,
    });

    await vaccinationService.confirmRecord(record.id, vet.id);

    const report = await reportService.generateQuarantineReport({
      reportPeriodStart: new Date("2026-05-01"),
      reportPeriodEnd: new Date("2026-05-31"),
      penIds: [pen.id],
      generatedBy: "系统管理员",
    });

    expect(report.status).toBe("draft");
    expect(report.penIds).toBe(JSON.stringify([pen.id]));
    expect(report.totalAnimals).toBe(200);
    expect(report.reportContent).toContain("检疫报表");
    expect(report.reportContent).toContain("羊");
  });
});
