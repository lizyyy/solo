import "reflect-metadata";
import { TestDataSource } from "./config/test-database";
import { VaccinationService } from "./services/VaccinationService";
import { SupplementaryService } from "./services/SupplementaryService";
import { TraceabilityService } from "./services/TraceabilityService";
import { ReportService } from "./services/ReportService";

async function runTests() {
  console.log("=== 养殖疫苗接种批次服务 - 主流程测试 ===");
  console.log("");

  await TestDataSource.initialize();

  const vaccinationService = new VaccinationService(TestDataSource);
  const supplementaryService = new SupplementaryService(TestDataSource);
  const traceabilityService = new TraceabilityService(TestDataSource);
  const reportService = new ReportService(TestDataSource);

  let passed = 0;
  let failed = 0;

  try {
    console.log("测试1: 创建栏舍...");
    const pen = await vaccinationService.createPen({
      name: "栏舍A",
      status: "active",
      animalType: "猪",
      animalCount: 100,
    });
    console.log("✓ 栏舍创建成功:", pen.name, "-", pen.animalCount, "头");
    passed++;

    console.log("\n测试2: 创建接种计划...");
    const plan = await vaccinationService.createPlan({
      name: "猪瘟疫苗接种计划",
      vaccineName: "猪瘟活疫苗",
      scheduledDate: new Date("2026-05-15"),
      targetAnimalCount: 100,
      penId: pen.id,
    });
    console.log("✓ 计划创建成功:", plan.name, "- 状态:", plan.status);
    passed++;

    console.log("\n测试3: 创建兽医...");
    const vet = await vaccinationService.createVeterinarian({
      name: "张医生",
      licenseNumber: "VET-CLI-001",
      phone: "13800138001",
    });
    console.log("✓ 兽医创建成功:", vet.name, "- 执业证:", vet.licenseNumber);
    passed++;

    console.log("\n测试4: 创建疫苗批次...");
    const batch = await vaccinationService.createBatch({
      batchNumber: "BATCH-CLI-2026-001",
      vaccineName: "猪瘟活疫苗",
      manufacturer: "某生物制品厂",
      productionDate: new Date("2026-01-01"),
      expiryDate: new Date("2027-01-01"),
      quantity: 100,
      planId: plan.id,
    });
    console.log("✓ 批次创建成功:", batch.batchNumber, "- 库存:", batch.quantity);
    passed++;

    console.log("\n测试5: 创建接种记录...");
    const record = await vaccinationService.createVaccinationRecord({
      vaccinationDate: new Date("2026-05-15"),
      animalCount: 100,
      penId: pen.id,
      planId: plan.id,
      veterinarianId: vet.id,
      batchId: batch.id,
    });
    console.log("✓ 记录创建成功 - 状态:", record.status);
    passed++;

    console.log("\n测试6: 确认接种记录...");
    const confirmedRecord = await vaccinationService.confirmRecord(record.id, vet.id);
    console.log("✓ 记录确认成功 - 状态:", confirmedRecord.status);
    passed++;

    console.log("\n测试7: 验证计划完成...");
    const penRepo = TestDataSource.getRepository("Pen");
    const updatedPen = await penRepo.findOne({ where: { id: pen.id } });
    if (updatedPen && updatedPen.lastVaccinationDate) {
      console.log("✓ 栏舍最后接种日期已更新");
      passed++;
    } else {
      console.log("✗ 栏舍最后接种日期未更新");
      failed++;
    }

    console.log("\n测试8: 批次追溯...");
    const traceResult = await traceabilityService.traceBatch(batch.id);
    if (
      traceResult.batch.id === batch.id &&
      traceResult.summary.totalAnimals === 100 &&
      traceResult.summary.vaccinatedAnimals === 100
    ) {
      console.log("✓ 批次追溯正确 - 完成率: 100%");
      passed++;
    } else {
      console.log("✗ 批次追溯数据不正确");
      failed++;
    }

    console.log("\n测试9: 检疫报表生成...");
    const report = await reportService.generateQuarantineReport({
      reportPeriodStart: new Date("2026-05-01"),
      reportPeriodEnd: new Date("2026-05-31"),
      penIds: [pen.id],
      generatedBy: "系统管理员",
    });
    if (report.status === "draft" && report.totalAnimals === 100) {
      console.log("✓ 报表生成成功 - 总动物数:", report.totalAnimals);
      passed++;
    } else {
      console.log("✗ 报表生成失败");
      failed++;
    }

    console.log("\n测试10: 补录流程（边界测试）...");
    const pen2 = await vaccinationService.createPen({
      name: "栏舍B",
      status: "active",
      animalType: "牛",
      animalCount: 50,
    });

    const plan2 = await vaccinationService.createPlan({
      name: "口蹄疫疫苗接种计划",
      vaccineName: "口蹄疫灭活疫苗",
      scheduledDate: new Date("2026-05-20"),
      targetAnimalCount: 50,
      penId: pen2.id,
    });

    const batch2 = await vaccinationService.createBatch({
      batchNumber: "BATCH-CLI-2026-002",
      vaccineName: "口蹄疫灭活疫苗",
      manufacturer: "某生物制品厂",
      productionDate: new Date("2026-02-01"),
      expiryDate: new Date("2027-02-01"),
      quantity: 50,
      planId: plan2.id,
    });

    const record2 = await vaccinationService.createVaccinationRecord({
      vaccinationDate: new Date("2026-05-19"),
      animalCount: 50,
      penId: pen2.id,
      planId: plan2.id,
      veterinarianId: vet.id,
      batchId: batch2.id,
    });

    const rejectedRecord = await vaccinationService.rejectRecord(
      record2.id,
      "接种日期错误"
    );
    if (rejectedRecord.status === "rejected") {
      console.log("✓ 记录拒绝成功");
      passed++;
    } else {
      console.log("✗ 记录拒绝失败");
      failed++;
    }

    const supplementary = await supplementaryService.submitSupplementary({
      originalRecordId: record2.id,
      actualVaccinationDate: new Date("2026-05-20"),
      reasonForSupplementary: "系统记录日期错误",
      submittedBy: "张医生",
    });
    if (supplementary.status === "pending") {
      console.log("✓ 补录申请提交成功");
      passed++;
    } else {
      console.log("✗ 补录申请失败");
      failed++;
    }

    const approved = await supplementaryService.approveSupplementary({
      supplementaryId: supplementary.id,
      reviewedBy: "审核员",
      reviewComments: "情况属实",
    });
    if (approved.status === "approved") {
      console.log("✓ 补录审核通过");
      passed++;
    } else {
      console.log("✗ 补录审核失败");
      failed++;
    }

    console.log("\n测试11: 异常处理 - 过期疫苗...");
    try {
      const pen3 = await vaccinationService.createPen({
        name: "栏舍C",
        status: "active",
        animalType: "羊",
        animalCount: 30,
      });

      const plan3 = await vaccinationService.createPlan({
        name: "羊痘疫苗接种计划",
        vaccineName: "羊痘活疫苗",
        scheduledDate: new Date("2026-05-25"),
        targetAnimalCount: 30,
        penId: pen3.id,
      });

      const expiredBatch = await vaccinationService.createBatch({
        batchNumber: "BATCH-CLI-EXPIRED",
        vaccineName: "过期疫苗",
        manufacturer: "某厂",
        productionDate: new Date("2025-01-01"),
        expiryDate: new Date("2025-12-31"),
        quantity: 30,
        planId: plan3.id,
      });

      await vaccinationService.createVaccinationRecord({
        vaccinationDate: new Date("2026-05-25"),
        animalCount: 30,
        penId: pen3.id,
        planId: plan3.id,
        veterinarianId: vet.id,
        batchId: expiredBatch.id,
      });
      console.log("✗ 应该抛出过期疫苗异常");
      failed++;
    } catch (error) {
      if ((error as Error).message === "疫苗已过期") {
        console.log("✓ 过期疫苗异常捕获成功");
        passed++;
      } else {
        console.log("✗ 异常类型不正确:", (error as Error).message);
        failed++;
      }
    }

    console.log("\n测试12: 异常处理 - 数量超限...");
    try {
      const pen4 = await vaccinationService.createPen({
        name: "栏舍D",
        status: "active",
        animalType: "鸡",
        animalCount: 100,
      });

      await vaccinationService.createPlan({
        name: "禽流感疫苗接种计划",
        vaccineName: "禽流感灭活疫苗",
        scheduledDate: new Date("2026-05-30"),
        targetAnimalCount: 200,
        penId: pen4.id,
      });
      console.log("✗ 应该抛出数量超限异常");
      failed++;
    } catch (error) {
      if ((error as Error).message === "目标动物数量不能超过栏舍总动物数") {
        console.log("✓ 数量超限异常捕获成功");
        passed++;
      } else {
        console.log("✗ 异常类型不正确:", (error as Error).message);
        failed++;
      }
    }

    console.log("\n=== 测试总结 ===");
    console.log("通过:", passed);
    console.log("失败:", failed);
    console.log("成功率:", ((passed / (passed + failed)) * 100).toFixed(1) + "%");

    if (failed === 0) {
      console.log("\n✓ 所有测试通过！服务可以正常运行。");
    } else {
      console.log("\n✗ 有测试失败，请检查代码。");
      process.exit(1);
    }
  } catch (error) {
    console.error("\n✗ 测试执行出错:", (error as Error).message);
    console.error((error as Error).stack);
    process.exit(1);
  } finally {
    await TestDataSource.destroy();
  }
}

runTests();
