import { AppDataSource } from "../config/database";
import { Batch, BatchStatus } from "../entities/Batch";
import { VaccinationRecord, RecordStatus } from "../entities/VaccinationRecord";
import { Pen } from "../entities/Pen";
import { Veterinarian } from "../entities/Veterinarian";
import { VaccinationPlan } from "../entities/VaccinationPlan";
import { In, DataSource } from "typeorm";

export class TraceabilityService {
  private dataSource: DataSource;
  private batchRepository;
  private recordRepository;
  private penRepository;
  private vetRepository;
  private planRepository;

  constructor(dataSource?: DataSource) {
    this.dataSource = dataSource || AppDataSource;
    this.batchRepository = this.dataSource.getRepository(Batch);
    this.recordRepository = this.dataSource.getRepository(VaccinationRecord);
    this.penRepository = this.dataSource.getRepository(Pen);
    this.vetRepository = this.dataSource.getRepository(Veterinarian);
    this.planRepository = this.dataSource.getRepository(VaccinationPlan);
  }

  async traceBatch(batchId: string): Promise<{
    batch: Batch;
    plan: VaccinationPlan;
    pen: Pen;
    records: VaccinationRecord[];
    veterinarians: Veterinarian[];
    summary: {
      totalAnimals: number;
      vaccinatedAnimals: number;
      pendingAnimals: number;
      completionRate: number;
      isReadyForQuarantine: boolean;
    };
  }> {
    const batch = await this.batchRepository.findOne({
      where: { id: batchId },
      relations: ["plan", "plan.pen"],
    });
    if (!batch) throw new Error("疫苗批次不存在");

    const plan = batch.plan;
    if (!plan) throw new Error("接种计划不存在");

    const pen = plan.pen;
    if (!pen) throw new Error("栏舍信息不存在");

    const records = await this.recordRepository.find({
      where: { batchId },
      relations: ["veterinarian"],
      order: { vaccinationDate: "ASC" },
    });

    const veterinarianIds = [...new Set(records.map((r) => r.veterinarianId))];
    const veterinarians = await this.vetRepository.find({
      where: { id: In(veterinarianIds) },
    });

    const totalAnimals = plan.targetAnimalCount;
    const vaccinatedAnimals = records
      .filter((r) => r.status === "confirmed")
      .reduce((sum, r) => sum + r.animalCount, 0);
    const pendingAnimals = records
      .filter((r) => r.status === "pending" || r.status === "needs_review")
      .reduce((sum, r) => sum + r.animalCount, 0);
    const completionRate = totalAnimals > 0 ? (vaccinatedAnimals / totalAnimals) * 100 : 0;

    const isReadyForQuarantine = this.checkBatchReadyForQuarantine(
      batch,
      records,
      plan
    );

    return {
      batch,
      plan,
      pen,
      records,
      veterinarians,
      summary: {
        totalAnimals,
        vaccinatedAnimals,
        pendingAnimals,
        completionRate,
        isReadyForQuarantine,
      },
    };
  }

  async tracePen(penId: string): Promise<{
    pen: Pen;
    plans: VaccinationPlan[];
    recentRecords: VaccinationRecord[];
    vaccinationSummary: {
      totalVaccinations: number;
      pendingPlans: number;
      completedPlans: number;
      lastVaccinationDate: Date | null;
    };
  }> {
    const pen = await this.penRepository.findOne({
      where: { id: penId },
    });
    if (!pen) throw new Error("栏舍不存在");

    const plans = await this.planRepository.find({
      where: { penId },
      relations: ["batches"],
      order: { scheduledDate: "DESC" },
    });

    const recentRecords = await this.recordRepository.find({
      where: { penId },
      relations: ["plan", "veterinarian", "batch"],
      order: { vaccinationDate: "DESC" },
      take: 20,
    });

    const pendingPlans = plans.filter((p) => p.status === "pending" || p.status === "in_progress").length;
    const completedPlans = plans.filter((p) => p.status === "completed").length;

    return {
      pen,
      plans,
      recentRecords,
      vaccinationSummary: {
        totalVaccinations: recentRecords.length,
        pendingPlans,
        completedPlans,
        lastVaccinationDate: pen.lastVaccinationDate || null,
      },
    };
  }

  async getRecordTimeline(recordId: string): Promise<{
    current: VaccinationRecord;
    timeline: {
      date: Date;
      status: RecordStatus;
      reason?: string;
      type: "creation" | "status_change" | "supplementary";
    }[];
  }> {
    const current = await this.recordRepository.findOne({
      where: { id: recordId },
    });
    if (!current) throw new Error("接种记录不存在");

    const timeline: {
      date: Date;
      status: RecordStatus;
      reason?: string;
      type: "creation" | "status_change" | "supplementary";
    }[] = [];

    timeline.push({
      date: current.createdAt,
      status: "pending",
      type: "creation",
    });

    if (current.status === "confirmed") {
      timeline.push({
        date: current.updatedAt,
        status: "confirmed",
        type: "status_change",
      });
    } else if (current.status === "rejected") {
      timeline.push({
        date: current.updatedAt,
        status: "rejected",
        reason: current.rejectionReason,
        type: "status_change",
      });
    } else if (current.status === "needs_review") {
      timeline.push({
        date: current.updatedAt,
        status: "needs_review",
        type: "status_change",
      });
    }

    return {
      current,
      timeline,
    };
  }

  private checkBatchReadyForQuarantine(
    batch: Batch,
    records: VaccinationRecord[],
    plan: VaccinationPlan
  ): boolean {
    if (batch.status === "cancelled") return false;
    if (new Date(batch.expiryDate) < new Date()) return false;

    const confirmedRecords = records.filter((r) => r.status === "confirmed");
    const totalVaccinated = confirmedRecords.reduce((sum, r) => sum + r.animalCount, 0);

    if (totalVaccinated < plan.targetAnimalCount) return false;

    const hasPendingRecords = records.some(
      (r) => r.status === "pending" || r.status === "needs_review"
    );
    if (hasPendingRecords) return false;

    return true;
  }
}
