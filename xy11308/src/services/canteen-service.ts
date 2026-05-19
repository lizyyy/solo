import { QueryRunner } from 'typeorm';
import { AppDataSource } from '../database/data-source';
import { Elder } from '../entities/Elder';
import { Meal } from '../entities/Meal';
import { MealAssignment, AssignmentStatus } from '../entities/MealAssignment';
import { MealChange, ChangeReason } from '../entities/MealChange';
import { Delivery, DeliveryStatus } from '../entities/Delivery';
import { FollowUp, SatisfactionLevel } from '../entities/FollowUp';
import { RuleEngine, RuleCheckSummary } from './rule-engine';
import { AuditService, AuditContext } from './audit-service';
import { AuditEntity } from '../entities/AuditLog';

export interface AssignMealRequest {
  elderId: string;
  mealId: string;
  notes?: string;
}

export interface ChangeMealRequest {
  assignmentId: string;
  newMealId: string;
  reason: ChangeReason;
  reasonDetails?: string;
}

export interface UpdateDeliveryRequest {
  assignmentId: string;
  status: DeliveryStatus;
  deliveryPerson?: string;
  deliveryRoute?: string[];
  estimatedDeliveryTime?: Date;
  actualDeliveryTime?: Date;
  recipientName?: string;
  failureReason?: string;
  notes?: string;
}

export interface CreateFollowUpRequest {
  assignmentId: string;
  satisfaction: SatisfactionLevel;
  mealQualityOk?: boolean;
  temperatureOk?: boolean;
  deliveryTimeOk?: boolean;
  complaints?: string[];
  suggestions?: string[];
  notes?: string;
}

export class CanteenService {
  private static get elderRepository() {
    return AppDataSource.getRepository(Elder);
  }

  private static get mealRepository() {
    return AppDataSource.getRepository(Meal);
  }

  private static get assignmentRepository() {
    return AppDataSource.getRepository(MealAssignment);
  }

  private static get mealChangeRepository() {
    return AppDataSource.getRepository(MealChange);
  }

  private static get deliveryRepository() {
    return AppDataSource.getRepository(Delivery);
  }

  private static get followUpRepository() {
    return AppDataSource.getRepository(FollowUp);
  }

  static async createElder(data: Partial<Elder>, context: AuditContext): Promise<Elder> {
    const elder = this.elderRepository.create({
      ...data,
      createdBy: context.operator,
      createdByRole: context.operatorRole
    });
    const saved = await this.elderRepository.save(elder);
    await AuditService.logCreate(AuditEntity.ELDER, saved.id, saved, context);
    return saved;
  }

  static async getElder(id: string): Promise<Elder | null> {
    return await this.elderRepository.findOneBy({ id });
  }

  static async getElders(filters?: { name?: string; isActive?: boolean }): Promise<Elder[]> {
    const query = this.elderRepository.createQueryBuilder('elder');
    if (filters?.name) {
      query.andWhere('elder.name LIKE :name', { name: `%${filters.name}%` });
    }
    if (filters?.isActive !== undefined) {
      query.andWhere('elder.isActive = :isActive', { isActive: filters.isActive });
    }
    return await query.getMany();
  }

  static async createMeal(data: Partial<Meal>, context: AuditContext): Promise<Meal> {
    const meal = this.mealRepository.create({
      ...data,
      createdBy: context.operator,
      createdByRole: context.operatorRole
    });
    const saved = await this.mealRepository.save(meal);
    await AuditService.logCreate(AuditEntity.MEAL, saved.id, saved, context);
    return saved;
  }

  static async getMeal(id: string): Promise<Meal | null> {
    return await this.mealRepository.findOneBy({ id });
  }

  static async getMeals(filters?: { date?: Date; type?: string }): Promise<Meal[]> {
    const query = this.mealRepository.createQueryBuilder('meal');
    if (filters?.date) {
      query.andWhere('DATE(meal.date) = DATE(:date)', { date: filters.date });
    }
    if (filters?.type) {
      query.andWhere('meal.type = :type', { type: filters.type });
    }
    return await query.getMany();
  }

  static async checkMealConflict(elderId: string, mealId: string): Promise<RuleCheckSummary> {
    const elder = await this.getElder(elderId);
    const meal = await this.getMeal(mealId);

    if (!elder || !meal) {
      throw new Error('老人或餐食不存在');
    }

    return await RuleEngine.checkMealAssignment(elder, meal);
  }

  static async assignMeal(
    request: AssignMealRequest,
    context: AuditContext,
    queryRunner?: QueryRunner
  ): Promise<MealAssignment> {
    const elder = await this.getElder(request.elderId);
    const meal = await this.getMeal(request.mealId);

    if (!elder) {
      throw new Error('老人不存在');
    }
    if (!meal) {
      throw new Error('餐食不存在');
    }

    const ruleCheck = await RuleEngine.checkMealAssignment(elder, meal);

    const repo = queryRunner ? queryRunner.manager.getRepository(MealAssignment) : this.assignmentRepository;
    const assignment = repo.create({
      elderId: request.elderId,
      mealId: request.mealId,
      status: ruleCheck.overallPassed ? AssignmentStatus.PENDING : AssignmentStatus.CONFIRMED,
      hasConflicts: !ruleCheck.overallPassed,
      ruleCheckResults: RuleEngine.formatResultsForStorage(ruleCheck),
      ruleCheckDetails: RuleEngine.formatDetailsForStorage(ruleCheck),
      notes: request.notes,
      assignedBy: context.operator,
      assignedByRole: context.operatorRole
    });

    const saved = await repo.save(assignment);

    await AuditService.logRuleCheck(
      AuditEntity.MEAL_ASSIGNMENT,
      saved.id,
      ruleCheck.overallPassed,
      ruleCheck.blockReasons.join('；') || ruleCheck.warningReasons.join('；'),
      context
    );

    return saved;
  }

  static async getAssignment(id: string): Promise<MealAssignment | null> {
    return await this.assignmentRepository.findOne({
      where: { id },
      relations: ['elder', 'meal']
    });
  }

  static async getAssignments(filters?: {
    elderId?: string;
    mealId?: string;
    status?: AssignmentStatus;
    hasConflicts?: boolean;
    assignedBy?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<MealAssignment[]> {
    const query = this.assignmentRepository.createQueryBuilder('assignment')
      .leftJoinAndSelect('assignment.elder', 'elder')
      .leftJoinAndSelect('assignment.meal', 'meal');

    if (filters?.elderId) {
      query.andWhere('assignment.elderId = :elderId', { elderId: filters.elderId });
    }
    if (filters?.mealId) {
      query.andWhere('assignment.mealId = :mealId', { mealId: filters.mealId });
    }
    if (filters?.status) {
      query.andWhere('assignment.status = :status', { status: filters.status });
    }
    if (filters?.hasConflicts !== undefined) {
      query.andWhere('assignment.hasConflicts = :hasConflicts', { hasConflicts: filters.hasConflicts });
    }
    if (filters?.assignedBy) {
      query.andWhere('assignment.assignedBy LIKE :assignedBy', { assignedBy: `%${filters.assignedBy}%` });
    }
    if (filters?.startDate) {
      query.andWhere('assignment.assignedAt >= :startDate', { startDate: filters.startDate });
    }
    if (filters?.endDate) {
      query.andWhere('assignment.assignedAt <= :endDate', { endDate: filters.endDate });
    }

    query.orderBy('assignment.assignedAt', 'DESC');
    return await query.getMany();
  }

  static async changeMeal(
    request: ChangeMealRequest,
    context: AuditContext,
    queryRunner?: QueryRunner
  ): Promise<MealChange> {
    const assignment = await this.getAssignment(request.assignmentId);
    if (!assignment) {
      throw new Error('配餐记录不存在');
    }

    const newMeal = await this.getMeal(request.newMealId);
    if (!newMeal) {
      throw new Error('新餐食不存在');
    }

    const elder = await this.getElder(assignment.elderId);
    if (!elder) {
      throw new Error('老人不存在');
    }

    const ruleCheck = await RuleEngine.checkMealAssignment(elder, newMeal);

    const changeRepo = queryRunner ? queryRunner.manager.getRepository(MealChange) : this.mealChangeRepository;
    const assignmentRepo = queryRunner ? queryRunner.manager.getRepository(MealAssignment) : this.assignmentRepository;

    const mealChange = changeRepo.create({
      assignmentId: request.assignmentId,
      originalMealId: assignment.mealId,
      newMealId: request.newMealId,
      reason: request.reason,
      reasonDetails: request.reasonDetails,
      ruleCheckResults: RuleEngine.formatResultsForStorage(ruleCheck),
      ruleCheckDetails: RuleEngine.formatDetailsForStorage(ruleCheck),
      changedBy: context.operator,
      changedByRole: context.operatorRole
    });

    const savedChange = await changeRepo.save(mealChange);

    assignment.mealId = request.newMealId;
    assignment.status = AssignmentStatus.CHANGED;
    assignment.hasConflicts = !ruleCheck.overallPassed;
    assignment.ruleCheckResults = RuleEngine.formatResultsForStorage(ruleCheck);
    assignment.ruleCheckDetails = RuleEngine.formatDetailsForStorage(ruleCheck);
    await assignmentRepo.save(assignment);

    await AuditService.logRuleCheck(
      AuditEntity.MEAL_CHANGE,
      savedChange.id,
      ruleCheck.overallPassed,
      ruleCheck.blockReasons.join('；') || ruleCheck.warningReasons.join('；'),
      context
    );

    return savedChange;
  }

  static async getMealChanges(assignmentId: string): Promise<MealChange[]> {
    return await this.mealChangeRepository.find({
      where: { assignmentId },
      relations: ['originalMeal', 'newMeal'],
      order: { changedAt: 'DESC' }
    });
  }

  static async updateDelivery(
    request: UpdateDeliveryRequest,
    context: AuditContext,
    queryRunner?: QueryRunner
  ): Promise<Delivery> {
    const repo = queryRunner ? queryRunner.manager.getRepository(Delivery) : this.deliveryRepository;
    const assignmentRepo = queryRunner ? queryRunner.manager.getRepository(MealAssignment) : this.assignmentRepository;

    let delivery = await repo.findOneBy({ assignmentId: request.assignmentId });

    if (!delivery) {
      delivery = repo.create({
        assignmentId: request.assignmentId,
        createdBy: context.operator,
        createdByRole: context.operatorRole
      });
    }

    delivery.status = request.status;
    if (request.deliveryPerson) delivery.deliveryPerson = request.deliveryPerson;
    if (request.deliveryRoute) delivery.deliveryRoute = request.deliveryRoute;
    if (request.estimatedDeliveryTime) delivery.estimatedDeliveryTime = request.estimatedDeliveryTime;
    if (request.actualDeliveryTime) delivery.actualDeliveryTime = request.actualDeliveryTime;
    if (request.recipientName) delivery.recipientName = request.recipientName;
    if (request.failureReason) delivery.failureReason = request.failureReason;
    if (request.notes) delivery.notes = request.notes;

    const saved = await repo.save(delivery);

    if (request.status === DeliveryStatus.DELIVERED) {
      const assignment = await assignmentRepo.findOneBy({ id: request.assignmentId });
      if (assignment) {
        assignment.status = AssignmentStatus.DELIVERED;
        await assignmentRepo.save(assignment);
      }
    }

    return saved;
  }

  static async getDelivery(id: string): Promise<Delivery | null> {
    return await this.deliveryRepository.findOne({
      where: { id },
      relations: ['assignment', 'assignment.elder', 'assignment.meal']
    });
  }

  static async getDeliveries(filters?: {
    status?: DeliveryStatus;
    deliveryPerson?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<Delivery[]> {
    const query = this.deliveryRepository.createQueryBuilder('delivery')
      .leftJoinAndSelect('delivery.assignment', 'assignment')
      .leftJoinAndSelect('assignment.elder', 'elder')
      .leftJoinAndSelect('assignment.meal', 'meal');

    if (filters?.status) {
      query.andWhere('delivery.status = :status', { status: filters.status });
    }
    if (filters?.deliveryPerson) {
      query.andWhere('delivery.deliveryPerson LIKE :deliveryPerson', { deliveryPerson: `%${filters.deliveryPerson}%` });
    }
    if (filters?.startDate) {
      query.andWhere('delivery.createdAt >= :startDate', { startDate: filters.startDate });
    }
    if (filters?.endDate) {
      query.andWhere('delivery.createdAt <= :endDate', { endDate: filters.endDate });
    }

    query.orderBy('delivery.createdAt', 'DESC');
    return await query.getMany();
  }

  static async createFollowUp(
    request: CreateFollowUpRequest,
    context: AuditContext,
    queryRunner?: QueryRunner
  ): Promise<FollowUp> {
    const repo = queryRunner ? queryRunner.manager.getRepository(FollowUp) : this.followUpRepository;

    const followUp = repo.create({
      ...request,
      conductedBy: context.operator,
      conductedByRole: context.operatorRole
    });

    return await repo.save(followUp);
  }

  static async getFollowUp(id: string): Promise<FollowUp | null> {
    return await this.followUpRepository.findOne({
      where: { id },
      relations: ['assignment', 'assignment.elder', 'assignment.meal']
    });
  }

  static async getFollowUps(filters?: {
    assignmentId?: string;
    satisfaction?: SatisfactionLevel;
    conductedBy?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<FollowUp[]> {
    const query = this.followUpRepository.createQueryBuilder('followUp')
      .leftJoinAndSelect('followUp.assignment', 'assignment')
      .leftJoinAndSelect('assignment.elder', 'elder')
      .leftJoinAndSelect('assignment.meal', 'meal');

    if (filters?.assignmentId) {
      query.andWhere('followUp.assignmentId = :assignmentId', { assignmentId: filters.assignmentId });
    }
    if (filters?.satisfaction) {
      query.andWhere('followUp.satisfaction = :satisfaction', { satisfaction: filters.satisfaction });
    }
    if (filters?.conductedBy) {
      query.andWhere('followUp.conductedBy LIKE :conductedBy', { conductedBy: `%${filters.conductedBy}%` });
    }
    if (filters?.startDate) {
      query.andWhere('followUp.conductedAt >= :startDate', { startDate: filters.startDate });
    }
    if (filters?.endDate) {
      query.andWhere('followUp.conductedAt <= :endDate', { endDate: filters.endDate });
    }

    query.orderBy('followUp.conductedAt', 'DESC');
    return await query.getMany();
  }
}