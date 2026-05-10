import { 
  Injectable, 
  NotFoundException, 
  ForbiddenException,
  ConflictException,
  BadRequestException,
  Inject,
  forwardRef
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager, DataSource, UpdateResult } from 'typeorm';
import { Bill, BillStatus } from './bill.entity';
import { BillShare } from './bill-share.entity';
import { BillVersion } from './bill-version.entity';
import { CreateBillDto } from './dto/create-bill.dto';
import { UpdateBillDto } from './dto/update-bill.dto';
import { GroupsService } from '../groups/groups.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction, AuditEntityType } from '../audit/audit-log.entity';
import { IdempotencyService } from '../common/idempotency/idempotency.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class BillsService {
  constructor(
    @InjectRepository(Bill)
    private readonly billRepository: Repository<Bill>,
    @InjectRepository(BillShare)
    private readonly billShareRepository: Repository<BillShare>,
    @InjectRepository(BillVersion)
    private readonly billVersionRepository: Repository<BillVersion>,
    private readonly dataSource: DataSource,
    private readonly groupsService: GroupsService,
    private readonly auditService: AuditService,
    @Inject(forwardRef(() => IdempotencyService))
    private readonly idempotencyService: IdempotencyService,
  ) {}

  async findByGroup(groupId: string, userId: string) {
    const isMember = await this.groupsService.isGroupMember(groupId, userId);
    if (!isMember) {
      throw new ForbiddenException('您不是该分组成员');
    }

    return this.billRepository.find({
      where: { groupId },
      relations: ['shares'],
      order: { date: 'DESC', createdAt: 'DESC' },
    });
  }

  async findOne(id: string, userId: string) {
    const bill = await this.billRepository.findOne({
      where: { id },
      relations: ['shares', 'versions'],
    });

    if (!bill) {
      throw new NotFoundException('账单不存在');
    }

    const isMember = await this.groupsService.isGroupMember(bill.groupId, userId);
    if (!isMember) {
      throw new ForbiddenException('您不是该分组成员');
    }

    return bill;
  }

  async create(dto: CreateBillDto, userId: string) {
    const requestId = dto.requestId || uuidv4();

    const isMember = await this.groupsService.isGroupMember(dto.groupId, userId);
    if (!isMember) {
      throw new ForbiddenException('您不是该分组成员');
    }

    const sharesTotal = dto.shares.reduce((sum, s) => sum + s.amount, 0);
    if (Math.abs(sharesTotal - dto.amount) > 0.01) {
      throw new BadRequestException('分摊金额总和必须等于账单总金额');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const idempotencyResult = await this.idempotencyService.createOrGetRequest(
        requestId,
        userId,
        'POST /bills',
      );

      if (idempotencyResult.existing && idempotencyResult.response) {
        await queryRunner.rollbackTransaction();
        return idempotencyResult.response;
      }

      let bill;
      try {
        bill = queryRunner.manager.create(Bill, {
          title: dto.title,
          amount: dto.amount,
          description: dto.description,
          date: dto.date,
          groupId: dto.groupId,
          paidByUserId: dto.paidByUserId,
          requestId: requestId,
          status: BillStatus.PENDING,
          createdBy: userId,
          updatedBy: userId,
          shares: dto.shares.map((s) =>
            queryRunner.manager.create(BillShare, {
              userId: s.userId,
              amount: s.amount,
              percentage: s.percentage || 0,
              isSettled: false,
            }),
          ),
        });

        const savedBill = await queryRunner.manager.save(bill);

        const version = queryRunner.manager.create(BillVersion, {
          billId: savedBill.id,
          versionNumber: 1,
          snapshot: this.createBillSnapshot(savedBill),
          changeDescription: '创建账单',
          createdBy: userId,
          updatedBy: userId,
        });
        await queryRunner.manager.save(version);

        await queryRunner.commitTransaction();

        const billWithRelations = await this.billRepository.findOne({
          where: { id: savedBill.id },
          relations: ['shares', 'versions'],
        });

        await this.auditService.log({
          action: AuditAction.CREATE,
          entityType: AuditEntityType.BILL,
          entityId: savedBill.id,
          userId,
          groupId: dto.groupId,
          billId: savedBill.id,
          newValue: this.createBillSnapshot(billWithRelations),
          requestId: requestId,
        });

        await this.idempotencyService.markRequestCompleted(
          requestId,
          userId,
          'POST /bills',
          billWithRelations,
        );

        return billWithRelations;
      } catch (error: any) {
        if (error.code === '23505' && error.detail?.includes('requestId')) {
          await queryRunner.rollbackTransaction();
          const cached = await this.idempotencyService.getResponse(
            requestId,
            userId,
            'POST /bills',
          );
          if (cached) {
            return cached;
          }
          const existingBill = await this.billRepository.findOne({
            where: { requestId },
            relations: ['shares', 'versions'],
          });
          if (existingBill) {
            return existingBill;
          }
        }
        throw error;
      }
    } catch (error) {
      try {
        await queryRunner.rollbackTransaction();
      } catch {}
      throw error;
    } finally {
      try {
        await queryRunner.release();
      } catch {}
    }
  }

  async update(id: string, dto: UpdateBillDto, userId: string) {
    const bill = await this.findOne(id, userId);

    if (bill.status === BillStatus.SETTLED) {
      throw new ConflictException('已结算的账单不能修改');
    }

    const oldSnapshot = this.createBillSnapshot(bill);
    const expectedVersion = dto.expectedVersion;

    const newTitle = dto.title !== undefined ? dto.title : bill.title;
    const newAmount = dto.amount !== undefined ? dto.amount : bill.amount;
    const newDescription = dto.description !== undefined ? dto.description : bill.description;
    const newDate = dto.date !== undefined ? dto.date : bill.date;
    const newPaidBy = dto.paidByUserId !== undefined ? dto.paidByUserId : bill.paidByUserId;
    const newShares = dto.shares;

    if (newShares) {
      const sharesTotal = newShares.reduce((sum, s) => sum + s.amount, 0);
      if (Math.abs(sharesTotal - newAmount) > 0.01) {
        throw new BadRequestException('分摊金额总和必须等于账单总金额');
      }
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const updateResult: UpdateResult = await queryRunner.manager
        .createQueryBuilder()
        .update(Bill)
        .set({
          title: newTitle,
          amount: newAmount,
          description: newDescription,
          date: newDate,
          paidByUserId: newPaidBy,
          updatedBy: userId,
        })
        .where('id = :id', { id })
        .andWhere('version = :version', { version: expectedVersion })
        .execute();

      if (updateResult.affected === 0) {
        await queryRunner.rollbackTransaction();
        throw new ConflictException(
          '账单已被他人修改，请刷新后重试。当前版本可能已变更',
        );
      }

      if (newShares) {
        await queryRunner.manager
          .createQueryBuilder()
          .delete()
          .from(BillShare)
          .where('billId = :billId', { billId: id })
          .execute();

        const newBillShares = newShares.map((s) =>
          queryRunner.manager.create(BillShare, {
            billId: id,
            userId: s.userId,
            amount: s.amount,
            percentage: s.percentage || 0,
            isSettled: false,
          }),
        );
        await queryRunner.manager.save(newBillShares);
      }

      const updatedBill = await queryRunner.manager.findOne(Bill, {
        where: { id },
        relations: ['shares', 'versions'],
      });

      if (!updatedBill) {
        throw new NotFoundException('账单不存在');
      }

      const version = queryRunner.manager.create(BillVersion, {
        billId: id,
        versionNumber: updatedBill.version,
        snapshot: this.createBillSnapshot(updatedBill),
        changeDescription: dto.changeDescription || '更新账单',
        createdBy: userId,
        updatedBy: userId,
      });
      await queryRunner.manager.save(version);

      await queryRunner.commitTransaction();

      const billWithRelations = await this.billRepository.findOne({
        where: { id },
        relations: ['shares', 'versions'],
      });

      await this.auditService.log({
        action: AuditAction.UPDATE,
        entityType: AuditEntityType.BILL,
        entityId: id,
        userId,
        groupId: bill.groupId,
        billId: id,
        oldValue: oldSnapshot,
        newValue: this.createBillSnapshot(billWithRelations),
      });

      return billWithRelations;
    } catch (error) {
      try {
        await queryRunner.rollbackTransaction();
      } catch {}
      throw error;
    } finally {
      try {
        await queryRunner.release();
      } catch {}
    }
  }

  async delete(id: string, userId: string) {
    const bill = await this.findOne(id, userId);

    if (bill.createdBy !== userId) {
      throw new ForbiddenException('只有创建者可以删除账单');
    }

    if (bill.status === BillStatus.SETTLED) {
      throw new ConflictException('已结算的账单不能删除');
    }

    const oldSnapshot = this.createBillSnapshot(bill);

    await this.billRepository.remove(bill);

    await this.auditService.log({
      action: AuditAction.DELETE,
      entityType: AuditEntityType.BILL,
      entityId: id,
      userId,
      groupId: bill.groupId,
      billId: id,
      oldValue: oldSnapshot,
    });

    return { success: true };
  }

  async settle(id: string, userId: string) {
    const bill = await this.findOne(id, userId);

    if (bill.status === BillStatus.SETTLED) {
      throw new ConflictException('账单已结算');
    }

    const oldSnapshot = this.createBillSnapshot(bill);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const updateResult: UpdateResult = await queryRunner.manager
        .createQueryBuilder()
        .update(Bill)
        .set({
          status: BillStatus.SETTLED,
          updatedBy: userId,
        })
        .where('id = :id', { id })
        .andWhere('version = :version', { version: bill.version })
        .execute();

      if (updateResult.affected === 0) {
        await queryRunner.rollbackTransaction();
        throw new ConflictException('账单已被他人修改，请刷新后重试');
      }

      await queryRunner.manager
        .createQueryBuilder()
        .update(BillShare)
        .set({
          isSettled: true,
          settledAt: new Date(),
        })
        .where('billId = :billId', { billId: id })
        .execute();

      const updatedBill = await queryRunner.manager.findOne(Bill, {
        where: { id },
        relations: ['shares', 'versions'],
      });

      if (!updatedBill) {
        throw new NotFoundException('账单不存在');
      }

      const version = queryRunner.manager.create(BillVersion, {
        billId: id,
        versionNumber: updatedBill.version,
        snapshot: this.createBillSnapshot(updatedBill),
        changeDescription: '结算账单',
        createdBy: userId,
        updatedBy: userId,
      });
      await queryRunner.manager.save(version);

      await queryRunner.commitTransaction();

      const billWithRelations = await this.billRepository.findOne({
        where: { id },
        relations: ['shares', 'versions'],
      });

      await this.auditService.log({
        action: AuditAction.SETTLE,
        entityType: AuditEntityType.BILL,
        entityId: id,
        userId,
        groupId: bill.groupId,
        billId: id,
        oldValue: oldSnapshot,
        newValue: this.createBillSnapshot(billWithRelations),
      });

      return billWithRelations;
    } catch (error) {
      try {
        await queryRunner.rollbackTransaction();
      } catch {}
      throw error;
    } finally {
      try {
        await queryRunner.release();
      } catch {}
    }
  }

  async getHistory(id: string, userId: string) {
    await this.findOne(id, userId);

    return this.billVersionRepository.find({
      where: { billId: id },
      order: { versionNumber: 'DESC' },
    });
  }

  async getStatistics(groupId: string, userId: string) {
    const isMember = await this.groupsService.isGroupMember(groupId, userId);
    if (!isMember) {
      throw new ForbiddenException('您不是该分组成员');
    }

    const bills = await this.billRepository.find({
      where: { groupId },
      relations: ['shares'],
    });

    const totalAmount = bills
      .filter((b) => b.status === BillStatus.SETTLED)
      .reduce((sum, b) => sum + Number(b.amount), 0);

    const pendingAmount = bills
      .filter((b) => b.status === BillStatus.PENDING)
      .reduce((sum, b) => sum + Number(b.amount), 0);

    const myPaid = bills.reduce((sum, b) => {
      if (b.paidByUserId === userId) {
        return sum + Number(b.amount);
      }
      return sum;
    }, 0);

    const myOwe = bills.reduce((sum, b) => {
      const myShare = b.shares.find((s) => s.userId === userId);
      if (myShare && !myShare.isSettled) {
        return sum + Number(myShare.amount);
      }
      return sum;
    }, 0);

    return {
      totalBills: bills.length,
      settledBills: bills.filter((b) => b.status === BillStatus.SETTLED).length,
      pendingBills: bills.filter((b) => b.status === BillStatus.PENDING).length,
      totalAmount,
      pendingAmount,
      myPaid,
      myOwe,
      netBalance: myPaid - myOwe,
    };
  }

  private createBillSnapshot(bill: Bill): any {
    return {
      id: bill.id,
      title: bill.title,
      amount: bill.amount,
      description: bill.description,
      date: bill.date,
      groupId: bill.groupId,
      paidByUserId: bill.paidByUserId,
      status: bill.status,
      version: bill.version,
      shares: bill.shares?.map((s) => ({
        userId: s.userId,
        amount: s.amount,
        percentage: s.percentage,
        isSettled: s.isSettled,
      })) || [],
    };
  }
}
