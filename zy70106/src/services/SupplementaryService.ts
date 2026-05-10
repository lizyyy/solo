import { AppDataSource } from "../config/database";
import { VaccinationRecord, RecordStatus } from "../entities/VaccinationRecord";
import { SupplementaryRecord, SupplementaryStatus } from "../entities/SupplementaryRecord";
import { v4 as uuidv4 } from "uuid";
import { DataSource } from "typeorm";

export class SupplementaryService {
  private dataSource: DataSource;
  private recordRepository;
  private supplementaryRepository;

  constructor(dataSource?: DataSource) {
    this.dataSource = dataSource || AppDataSource;
    this.recordRepository = this.dataSource.getRepository(VaccinationRecord);
    this.supplementaryRepository = this.dataSource.getRepository(SupplementaryRecord);
  }

  async submitSupplementary(data: {
    originalRecordId: string;
    actualVaccinationDate: Date;
    reasonForSupplementary: string;
    submittedBy: string;
  }): Promise<SupplementaryRecord> {
    if (!data.originalRecordId) throw new Error("原始记录ID不能为空");
    if (!data.reasonForSupplementary || data.reasonForSupplementary.trim() === "") {
      throw new Error("补录原因不能为空");
    }
    if (!data.submittedBy) throw new Error("提交人不能为空");

    const originalRecord = await this.recordRepository.findOne({
      where: { id: data.originalRecordId },
    });
    if (!originalRecord) throw new Error("原始接种记录不存在");

    if (originalRecord.status !== "rejected" && originalRecord.status !== "needs_review") {
      throw new Error("只能对被拒绝或需要审核的记录进行补录");
    }

    const existingSupplementary = await this.supplementaryRepository.findOne({
      where: {
        originalRecordId: data.originalRecordId,
        status: "pending",
      },
    });
    if (existingSupplementary) {
      throw new Error("该记录已有待审核的补录申请");
    }

    const supplementary = this.supplementaryRepository.create({
      id: uuidv4(),
      status: "pending",
      ...data,
    });

    originalRecord.status = "needs_review";
    await this.recordRepository.save(originalRecord);

    return await this.supplementaryRepository.save(supplementary);
  }

  async approveSupplementary(data: {
    supplementaryId: string;
    reviewedBy: string;
    reviewComments?: string;
  }): Promise<SupplementaryRecord> {
    if (!data.supplementaryId) throw new Error("补录记录ID不能为空");
    if (!data.reviewedBy) throw new Error("审核人不能为空");

    const supplementary = await this.supplementaryRepository.findOne({
      where: { id: data.supplementaryId },
      relations: ["originalRecord"],
    });
    if (!supplementary) throw new Error("补录记录不存在");
    if (supplementary.status !== "pending") {
      throw new Error("只能审核待处理的补录记录");
    }

    const originalRecord = supplementary.originalRecord;
    if (!originalRecord) throw new Error("原始记录不存在");

    await this.dataSource.transaction(async (transactionalEntityManager) => {
      supplementary.status = "approved";
      supplementary.reviewedBy = data.reviewedBy;
      supplementary.reviewDate = new Date();
      supplementary.reviewComments = data.reviewComments;
      await transactionalEntityManager.save(supplementary);

      originalRecord.vaccinationDate = supplementary.actualVaccinationDate;
      originalRecord.status = "confirmed";
      originalRecord.rejectionReason = undefined;
      await transactionalEntityManager.save(originalRecord);
    });

    return supplementary;
  }

  async rejectSupplementary(data: {
    supplementaryId: string;
    reviewedBy: string;
    reviewComments: string;
  }): Promise<SupplementaryRecord> {
    if (!data.supplementaryId) throw new Error("补录记录ID不能为空");
    if (!data.reviewedBy) throw new Error("审核人不能为空");
    if (!data.reviewComments || data.reviewComments.trim() === "") {
      throw new Error("拒绝原因不能为空");
    }

    const supplementary = await this.supplementaryRepository.findOne({
      where: { id: data.supplementaryId },
      relations: ["originalRecord"],
    });
    if (!supplementary) throw new Error("补录记录不存在");
    if (supplementary.status !== "pending") {
      throw new Error("只能审核待处理的补录记录");
    }

    const originalRecord = supplementary.originalRecord;
    if (!originalRecord) throw new Error("原始记录不存在");

    await this.dataSource.transaction(async (transactionalEntityManager) => {
      supplementary.status = "rejected";
      supplementary.reviewedBy = data.reviewedBy;
      supplementary.reviewDate = new Date();
      supplementary.reviewComments = data.reviewComments;
      await transactionalEntityManager.save(supplementary);

      originalRecord.status = "rejected";
      await transactionalEntityManager.save(originalRecord);
    });

    return supplementary;
  }

  async getSupplementaryHistory(originalRecordId: string): Promise<SupplementaryRecord[]> {
    return await this.supplementaryRepository.find({
      where: { originalRecordId },
      order: { createdAt: "ASC" },
    });
  }
}
