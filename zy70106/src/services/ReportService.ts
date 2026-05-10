import { AppDataSource } from "../config/database";
import { QuarantineReport, ReportStatus } from "../entities/QuarantineReport";
import { Pen } from "../entities/Pen";
import { VaccinationPlan } from "../entities/VaccinationPlan";
import { VaccinationRecord, RecordStatus } from "../entities/VaccinationRecord";
import { v4 as uuidv4 } from "uuid";
import { In, DataSource } from "typeorm";

export class ReportService {
  private dataSource: DataSource;
  private reportRepository;
  private penRepository;
  private planRepository;
  private recordRepository;

  constructor(dataSource?: DataSource) {
    this.dataSource = dataSource || AppDataSource;
    this.reportRepository = this.dataSource.getRepository(QuarantineReport);
    this.penRepository = this.dataSource.getRepository(Pen);
    this.planRepository = this.dataSource.getRepository(VaccinationPlan);
    this.recordRepository = this.dataSource.getRepository(VaccinationRecord);
  }

  async generateQuarantineReport(data: {
    reportPeriodStart: Date;
    reportPeriodEnd: Date;
    penIds: string[];
    generatedBy: string;
  }): Promise<QuarantineReport> {
    if (!data.reportPeriodStart) throw new Error("报告起始日期不能为空");
    if (!data.reportPeriodEnd) throw new Error("报告结束日期不能为空");
    if (new Date(data.reportPeriodEnd) < new Date(data.reportPeriodStart)) {
      throw new Error("结束日期不能早于起始日期");
    }
    if (!data.penIds || data.penIds.length === 0) {
      throw new Error("至少选择一个栏舍");
    }
    if (!data.generatedBy) throw new Error("生成人不能为空");

    const pens = await this.penRepository.find({
      where: { id: In(data.penIds) },
    });
    if (pens.length !== data.penIds.length) {
      throw new Error("部分栏舍不存在");
    }

    const plans = await this.planRepository.find({
      where: {
        penId: In(data.penIds),
        scheduledDate: data.reportPeriodStart,
      },
    });

    const records = await this.recordRepository.find({
      where: {
        penId: In(data.penIds),
        vaccinationDate: data.reportPeriodStart,
      },
    });

    const confirmedRecords = records.filter((r) => r.status === "confirmed");

    const totalAnimals = pens.reduce((sum, p) => sum + p.animalCount, 0);
    const totalVaccinated = confirmedRecords.reduce((sum, r) => sum + r.animalCount, 0);

    const pendingVaccinations = plans
      .filter((p) => p.status === "pending" || p.status === "in_progress")
      .reduce((sum, p) => sum + p.targetAnimalCount, 0);

    const now = new Date();
    const overduePlans = plans.filter(
      (p) =>
        (p.status === "pending" || p.status === "in_progress") &&
        new Date(p.scheduledDate) < now
    );
    const overdueVaccinations = overduePlans.reduce(
      (sum, p) => sum + p.targetAnimalCount,
      0
    );

    const reportContent = this.generateReportContent(
      data.reportPeriodStart,
      data.reportPeriodEnd,
      pens,
      plans,
      records,
      totalAnimals,
      totalVaccinated,
      pendingVaccinations,
      overdueVaccinations
    );

    const { penIds, ...restData } = data;
    const report = this.reportRepository.create({
      ...restData,
      id: uuidv4(),
      reportNumber: `QR-${Date.now()}`,
      reportDate: new Date(),
      status: "draft",
      penIds: JSON.stringify(penIds),
      totalAnimals,
      totalVaccinated,
      pendingVaccinations,
      overdueVaccinations,
      reportContent,
    });

    return await this.reportRepository.save(report);
  }

  async submitReport(reportId: string): Promise<QuarantineReport> {
    const report = await this.reportRepository.findOne({ where: { id: reportId } });
    if (!report) throw new Error("报告不存在");
    if (report.status !== "draft") {
      throw new Error("只能提交草稿状态的报告");
    }

    report.status = "submitted";
    return await this.reportRepository.save(report);
  }

  async approveReport(reportId: string, approvedBy: string): Promise<QuarantineReport> {
    if (!approvedBy) throw new Error("审批人不能为空");

    const report = await this.reportRepository.findOne({ where: { id: reportId } });
    if (!report) throw new Error("报告不存在");
    if (report.status !== "submitted") {
      throw new Error("只能审批已提交的报告");
    }

    report.status = "approved";
    report.approvedBy = approvedBy;
    report.approvalDate = new Date();
    return await this.reportRepository.save(report);
  }

  async rejectReport(reportId: string, rejectionReason: string): Promise<QuarantineReport> {
    if (!rejectionReason || rejectionReason.trim() === "") {
      throw new Error("拒绝原因不能为空");
    }

    const report = await this.reportRepository.findOne({ where: { id: reportId } });
    if (!report) throw new Error("报告不存在");
    if (report.status !== "submitted") {
      throw new Error("只能拒绝已提交的报告");
    }

    report.status = "rejected";
    return await this.reportRepository.save(report);
  }

  async getReportStatus(reportId: string): Promise<{
    report: QuarantineReport;
    status: ReportStatus;
    isApproved: boolean;
    canSubmit: boolean;
    canApprove: boolean;
  }> {
    const report = await this.reportRepository.findOne({ where: { id: reportId } });
    if (!report) throw new Error("报告不存在");

    return {
      report,
      status: report.status,
      isApproved: report.status === "approved",
      canSubmit: report.status === "draft",
      canApprove: report.status === "submitted",
    };
  }

  private generateReportContent(
    startDate: Date,
    endDate: Date,
    pens: Pen[],
    plans: VaccinationPlan[],
    records: VaccinationRecord[],
    totalAnimals: number,
    totalVaccinated: number,
    pendingVaccinations: number,
    overdueVaccinations: number
  ): string {
    const vaccinationRate = totalAnimals > 0 ? ((totalVaccinated / totalAnimals) * 100).toFixed(2) : "0.00";
    const confirmedRecords = records.filter((r) => r.status === "confirmed");
    const rejectedRecords = records.filter((r) => r.status === "rejected");
    const pendingRecords = records.filter((r) => r.status === "pending" || r.status === "needs_review");

    const content = `
检疫报表
================
报告期间: ${startDate.toLocaleDateString()} 至 ${endDate.toLocaleDateString()}
生成时间: ${new Date().toLocaleString()}

一、基本信息
----------------
涉及栏舍数量: ${pens.length}
涉及动物总数: ${totalAnimals}

二、接种统计
----------------
已完成接种数量: ${totalVaccinated}
接种完成率: ${vaccinationRate}%
待接种数量: ${pendingVaccinations}
逾期接种数量: ${overdueVaccinations}

三、记录状态
----------------
已确认记录: ${confirmedRecords.length}
待处理记录: ${pendingRecords.length}
已拒绝记录: ${rejectedRecords.length}

四、详情
----------------
栏舍列表:
${pens.map((p) => `  - ${p.name} (${p.animalType}): ${p.animalCount}头`).join("\n")}

疫苗种类:
${[...new Set(plans.map((p) => p.vaccineName))].map((v) => `  - ${v}`).join("\n")}
    `.trim();

    return content;
  }
}
