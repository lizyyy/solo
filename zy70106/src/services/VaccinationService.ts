import { AppDataSource } from "../config/database";
import { Pen, PenStatus } from "../entities/Pen";
import { VaccinationPlan, PlanStatus } from "../entities/VaccinationPlan";
import { Veterinarian } from "../entities/Veterinarian";
import { Batch, BatchStatus } from "../entities/Batch";
import { VaccinationRecord, RecordStatus } from "../entities/VaccinationRecord";
import { v4 as uuidv4 } from "uuid";
import { In, DataSource } from "typeorm";

export class VaccinationService {
  private dataSource: DataSource;
  private penRepository;
  private planRepository;
  private vetRepository;
  private batchRepository;
  private recordRepository;

  constructor(dataSource?: DataSource) {
    this.dataSource = dataSource || AppDataSource;
    this.penRepository = this.dataSource.getRepository(Pen);
    this.planRepository = this.dataSource.getRepository(VaccinationPlan);
    this.vetRepository = this.dataSource.getRepository(Veterinarian);
    this.batchRepository = this.dataSource.getRepository(Batch);
    this.recordRepository = this.dataSource.getRepository(VaccinationRecord);
  }

  async createPen(data: Omit<Pen, "id" | "createdAt" | "updatedAt" | "plans" | "records">): Promise<Pen> {
    if (!data.name) throw new Error("栏舍名称不能为空");
    if (!data.animalType) throw new Error("动物类型不能为空");
    if (data.animalCount < 0) throw new Error("动物数量不能为负数");

    const pen = this.penRepository.create({
      id: uuidv4(),
      ...data,
    });
    return await this.penRepository.save(pen);
  }

  async createPlan(data: {
    name: string;
    vaccineName: string;
    scheduledDate: Date;
    targetAnimalCount: number;
    penId: string;
    notes?: string;
  }): Promise<VaccinationPlan> {
    const pen = await this.penRepository.findOne({ where: { id: data.penId } });
    if (!pen) throw new Error("栏舍不存在");
    if (pen.status === "inactive") throw new Error("栏舍已停用");
    if (!data.name) throw new Error("计划名称不能为空");
    if (!data.vaccineName) throw new Error("疫苗名称不能为空");
    if (data.targetAnimalCount <= 0) throw new Error("目标动物数量必须大于0");
    if (data.targetAnimalCount > pen.animalCount) {
      throw new Error("目标动物数量不能超过栏舍总动物数");
    }

    const plan = this.planRepository.create({
      id: uuidv4(),
      status: "pending",
      ...data,
    });
    return await this.planRepository.save(plan);
  }

  async createVeterinarian(data: {
    name: string;
    licenseNumber: string;
    phone: string;
    email?: string;
  }): Promise<Veterinarian> {
    if (!data.name) throw new Error("兽医姓名不能为空");
    if (!data.licenseNumber) throw new Error("执业证号不能为空");
    if (!data.phone) throw new Error("联系电话不能为空");

    const existing = await this.vetRepository.findOne({
      where: { licenseNumber: data.licenseNumber },
    });
    if (existing) throw new Error("执业证号已存在");

    const vet = this.vetRepository.create({
      id: uuidv4(),
      isActive: true,
      ...data,
    });
    return await this.vetRepository.save(vet);
  }

  async createBatch(data: {
    batchNumber: string;
    vaccineName: string;
    manufacturer: string;
    productionDate: Date;
    expiryDate: Date;
    quantity: number;
    planId: string;
  }): Promise<Batch> {
    const plan = await this.planRepository.findOne({ where: { id: data.planId } });
    if (!plan) throw new Error("接种计划不存在");
    if (plan.status === "completed" || plan.status === "cancelled") {
      throw new Error("不能为已完成或已取消的计划添加批次");
    }
    if (!data.batchNumber) throw new Error("批次号不能为空");
    if (!data.vaccineName) throw new Error("疫苗名称不能为空");
    if (data.quantity <= 0) throw new Error("疫苗数量必须大于0");
    if (new Date(data.expiryDate) <= new Date(data.productionDate)) {
      throw new Error("有效期必须晚于生产日期");
    }

    const existing = await this.batchRepository.findOne({
      where: { batchNumber: data.batchNumber },
    });
    if (existing) throw new Error("批次号已存在");

    const batch = this.batchRepository.create({
      id: uuidv4(),
      status: "pending",
      usedQuantity: 0,
      ...data,
    });
    return await this.batchRepository.save(batch);
  }

  async createVaccinationRecord(data: {
    vaccinationDate: Date;
    animalCount: number;
    penId: string;
    planId: string;
    veterinarianId: string;
    batchId: string;
    notes?: string;
    previousRecordId?: string;
  }): Promise<VaccinationRecord> {
    const pen = await this.penRepository.findOne({ where: { id: data.penId } });
    if (!pen) throw new Error("栏舍不存在");
    if (pen.status === "inactive") throw new Error("栏舍已停用");

    const plan = await this.planRepository.findOne({ where: { id: data.planId } });
    if (!plan) throw new Error("接种计划不存在");
    if (plan.status === "completed" || plan.status === "cancelled") {
      throw new Error("计划已完成或已取消，不能添加接种记录");
    }
    if (plan.penId !== data.penId) {
      throw new Error("接种计划不属于该栏舍");
    }

    const vet = await this.vetRepository.findOne({ where: { id: data.veterinarianId } });
    if (!vet) throw new Error("兽医不存在");
    if (!vet.isActive) throw new Error("兽医已停用");

    const batch = await this.batchRepository.findOne({ where: { id: data.batchId } });
    if (!batch) throw new Error("疫苗批次不存在");
    if (batch.planId !== data.planId) {
      throw new Error("疫苗批次不属于该计划");
    }
    if (batch.status === "cancelled") {
      throw new Error("疫苗批次已取消");
    }
    if (new Date(batch.expiryDate) < new Date(data.vaccinationDate)) {
      throw new Error("疫苗已过期");
    }
    if (batch.usedQuantity + data.animalCount > batch.quantity) {
      throw new Error("疫苗数量不足");
    }
    if (data.animalCount <= 0) throw new Error("接种数量必须大于0");

    const availableVaccines = plan.targetAnimalCount - plan.records?.filter(r => r.status === "confirmed").length;
    if (plan.records) {
      const confirmedRecords = await this.recordRepository.find({
        where: { planId: plan.id, status: In(["confirmed", "pending"]) },
      });
      const totalVaccinated = confirmedRecords.reduce((sum, r) => sum + r.animalCount, 0);
      if (totalVaccinated + data.animalCount > plan.targetAnimalCount) {
        throw new Error("接种数量超过计划目标");
      }
    }

    await this.dataSource.transaction(async (transactionalEntityManager) => {
      const record = transactionalEntityManager.create(VaccinationRecord, {
        id: uuidv4(),
        status: "pending",
        ...data,
      });
      await transactionalEntityManager.save(record);

      batch.usedQuantity += data.animalCount;
      batch.status = batch.usedQuantity > 0 ? "in_progress" : "pending";
      if (batch.usedQuantity === batch.quantity) {
        batch.status = "completed";
      }
      await transactionalEntityManager.save(batch);

      if (plan.status === "pending") {
        plan.status = "in_progress";
        await transactionalEntityManager.save(plan);
      }
    });

    return await this.recordRepository.findOne({
      where: { penId: data.penId, planId: data.planId, veterinarianId: data.veterinarianId },
      order: { createdAt: "DESC" },
    }) as VaccinationRecord;
  }

  async confirmRecord(recordId: string, veterinarianId: string): Promise<VaccinationRecord> {
    const record = await this.recordRepository.findOne({ where: { id: recordId } });
    if (!record) throw new Error("接种记录不存在");
    if (record.veterinarianId !== veterinarianId) {
      throw new Error("只能确认自己的接种记录");
    }
    if (record.status !== "pending") {
      throw new Error("只能确认待处理的记录");
    }

    record.status = "confirmed";
    const updatedRecord = await this.recordRepository.save(record);

    await this.checkPlanCompletion(record.planId);
    await this.updatePenLastVaccination(record.penId);

    return updatedRecord;
  }

  async rejectRecord(recordId: string, rejectionReason: string): Promise<VaccinationRecord> {
    if (!rejectionReason || rejectionReason.trim() === "") {
      throw new Error("拒绝原因不能为空");
    }

    const record = await this.recordRepository.findOne({ where: { id: recordId } });
    if (!record) throw new Error("接种记录不存在");
    if (record.status !== "pending" && record.status !== "needs_review") {
      throw new Error("只能拒绝待处理或需要审核的记录");
    }

    record.status = "rejected";
    record.rejectionReason = rejectionReason;
    return await this.recordRepository.save(record);
  }

  async getRecordWithHistory(recordId: string): Promise<{
    current: VaccinationRecord;
    previous: VaccinationRecord | null;
    history: VaccinationRecord[];
  }> {
    const current = await this.recordRepository.findOne({ where: { id: recordId } });
    if (!current) throw new Error("接种记录不存在");

    const history = [];
    let prevRecordId = current.previousRecordId;

    while (prevRecordId) {
      const prevRecord = await this.recordRepository.findOne({ where: { id: prevRecordId } });
      if (prevRecord) {
        history.unshift(prevRecord);
        prevRecordId = prevRecord.previousRecordId;
      } else {
        break;
      }
    }

    return {
      current,
      previous: history.length > 0 ? history[history.length - 1] : null,
      history,
    };
  }

  async getCurrentStuckPoint(planId: string): Promise<{
    plan: VaccinationPlan;
    pendingRecords: VaccinationRecord[];
    rejectedRecords: VaccinationRecord[];
    needsReviewRecords: VaccinationRecord[];
  } | null> {
    const plan = await this.planRepository.findOne({ where: { id: planId } });
    if (!plan) return null;

    const records = await this.recordRepository.find({
      where: { planId },
      order: { createdAt: "ASC" },
    });

    const pendingRecords = records.filter((r) => r.status === "pending");
    const rejectedRecords = records.filter((r) => r.status === "rejected");
    const needsReviewRecords = records.filter((r) => r.status === "needs_review");

    return {
      plan,
      pendingRecords,
      rejectedRecords,
      needsReviewRecords,
    };
  }

  private async checkPlanCompletion(planId: string): Promise<void> {
    const plan = await this.planRepository.findOne({ where: { id: planId } });
    if (!plan) return;

    const confirmedRecords = await this.recordRepository.find({
      where: { planId, status: "confirmed" },
    });

    const totalVaccinated = confirmedRecords.reduce((sum, r) => sum + r.animalCount, 0);

    if (totalVaccinated >= plan.targetAnimalCount) {
      plan.status = "completed";
      plan.completedDate = new Date();
      await this.planRepository.save(plan);
    }
  }

  private async updatePenLastVaccination(penId: string): Promise<void> {
    const pen = await this.penRepository.findOne({ where: { id: penId } });
    if (!pen) return;

    const latestRecord = await this.recordRepository.findOne({
      where: { penId, status: "confirmed" },
      order: { vaccinationDate: "DESC" },
    });

    if (latestRecord) {
      pen.lastVaccinationDate = latestRecord.vaccinationDate;
      await this.penRepository.save(pen);
    }
  }

  async validateBatchForQuarantine(batchId: string): Promise<boolean> {
    const batch = await this.batchRepository.findOne({
      where: { id: batchId },
      relations: ["records"],
    });
    if (!batch) throw new Error("疫苗批次不存在");

    if (batch.status === "cancelled") return false;
    if (new Date(batch.expiryDate) < new Date()) return false;

    const records = batch.records || [];
    const confirmedCount = records.filter((r) => r.status === "confirmed").length;
    const totalCount = records.length;

    if (totalCount === 0) return false;
    if (confirmedCount < totalCount) return false;

    return true;
  }
}
