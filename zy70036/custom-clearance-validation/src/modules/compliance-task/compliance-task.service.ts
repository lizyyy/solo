import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ComplianceTask,
  TaskStatus,
  TaskPriority,
  MissingComponentType,
} from '../../entities/compliance-task.entity';
import { ClearanceBatchService } from '../clearance-batch/clearance-batch.service';
import {
  CreateComplianceTaskDto,
  UpdateComplianceTaskDto,
  ComplianceTaskFilterDto,
} from './dto/compliance-task.dto';
import { MissingComponentService } from '../missing-component/missing-component.service';

@Injectable()
export class ComplianceTaskService {
  constructor(
    @InjectRepository(ComplianceTask)
    private readonly taskRepository: Repository<ComplianceTask>,
    private readonly batchService: ClearanceBatchService,
    private readonly missingComponentService: MissingComponentService,
  ) {}

  async create(dto: CreateComplianceTaskDto): Promise<ComplianceTask> {
    await this.batchService.findOne(dto.batchId);

    const task = this.taskRepository.create({
      ...dto,
      status: TaskStatus.PENDING,
      priority: dto.priority || TaskPriority.MEDIUM,
    });

    return this.taskRepository.save(task);
  }

  async createFromMissingDetection(batchId: string): Promise<ComplianceTask[]> {
    const missingResult = await this.missingComponentService.detectMissingComponents(batchId);
    const createdTasks: ComplianceTask[] = [];

    const groupedMissing = new Map<string, typeof missingResult.itemLevelMissing>();

    missingResult.itemLevelMissing.forEach(item => {
      const key = item.componentType;
      if (!groupedMissing.has(key)) {
        groupedMissing.set(key, []);
      }
      groupedMissing.get(key)!.push(item);
    });

    if (missingResult.documentLevelMissing.missingInvoice) {
      const task = this.taskRepository.create({
        batchId,
        title: '缺少发票',
        description: '批次缺少发票，请补充发票资料',
        componentType: MissingComponentType.INVOICE,
        priority: TaskPriority.CRITICAL,
        status: TaskStatus.PENDING,
      });
      createdTasks.push(await this.taskRepository.save(task));
    }

    if (missingResult.documentLevelMissing.missingPackingList) {
      const task = this.taskRepository.create({
        batchId,
        title: '缺少箱单',
        description: '批次缺少箱单，请补充箱单资料',
        componentType: MissingComponentType.PACKING_LIST,
        priority: TaskPriority.CRITICAL,
        status: TaskStatus.PENDING,
      });
      createdTasks.push(await this.taskRepository.save(task));
    }

    for (const [componentType, items] of groupedMissing.entries()) {
      if (items.length > 0) {
        const highestPriority = items.reduce(
          (max, item) => (this.getPriorityOrder(item.priority) > this.getPriorityOrder(max) ? item.priority : max),
          items[0].priority,
        );

        const task = this.taskRepository.create({
          batchId,
          title: `补充${this.getComponentTypeLabel(componentType as MissingComponentType)}资料`,
          description: `发现 ${items.length} 项${this.getComponentTypeLabel(componentType as MissingComponentType)}资料缺失或不完整`,
          componentType: componentType as MissingComponentType,
          priority: highestPriority,
          status: TaskStatus.PENDING,
          affectedItems: items.map(item => ({
            lineNumber: item.lineNumber || 0,
            hsCode: item.hsCode || '',
            productName: item.productName || '',
            issue: item.issue,
          })),
        });
        createdTasks.push(await this.taskRepository.save(task));
      }
    }

    return createdTasks;
  }

  private getPriorityOrder(priority: TaskPriority): number {
    const order = {
      [TaskPriority.LOW]: 1,
      [TaskPriority.MEDIUM]: 2,
      [TaskPriority.HIGH]: 3,
      [TaskPriority.CRITICAL]: 4,
    };
    return order[priority] || 0;
  }

  private getComponentTypeLabel(type: MissingComponentType): string {
    const labels: Record<MissingComponentType, string> = {
      [MissingComponentType.HS_CODE]: 'HS编码',
      [MissingComponentType.INVOICE]: '发票',
      [MissingComponentType.PACKING_LIST]: '箱单',
      [MissingComponentType.PRODUCT_INFO]: '商品信息',
      [MissingComponentType.WEIGHT]: '重量',
      [MissingComponentType.QUANTITY]: '数量',
      [MissingComponentType.VALUE]: '价值',
      [MissingComponentType.OTHER]: '其他',
    };
    return labels[type] || type;
  }

  async findAll(filter: ComplianceTaskFilterDto): Promise<ComplianceTask[]> {
    const queryBuilder = this.taskRepository.createQueryBuilder('task');

    if (filter.batchId) {
      queryBuilder.andWhere('task.batchId = :batchId', { batchId: filter.batchId });
    }

    if (filter.status) {
      queryBuilder.andWhere('task.status = :status', { status: filter.status });
    }

    if (filter.priority) {
      queryBuilder.andWhere('task.priority = :priority', { priority: filter.priority });
    }

    if (filter.componentType) {
      queryBuilder.andWhere('task.componentType = :componentType', { componentType: filter.componentType });
    }

    if (filter.assignee) {
      queryBuilder.andWhere('task.assignee = :assignee', { assignee: filter.assignee });
    }

    queryBuilder.orderBy('task.priority', 'DESC');
    queryBuilder.addOrderBy('task.createdAt', 'DESC');

    return queryBuilder.getMany();
  }

  async findOne(id: string): Promise<ComplianceTask> {
    const task = await this.taskRepository.findOne({ where: { id } });
    if (!task) {
      throw new NotFoundException(`补料任务 ${id} 不存在`);
    }
    return task;
  }

  async findByBatch(batchId: string): Promise<ComplianceTask[]> {
    return this.taskRepository.find({
      where: { batchId },
      order: { priority: 'DESC', createdAt: 'DESC' },
    });
  }

  async update(id: string, dto: UpdateComplianceTaskDto): Promise<ComplianceTask> {
    const task = await this.findOne(id);
    Object.assign(task, dto);
    return this.taskRepository.save(task);
  }

  async resolve(id: string, resolutionNotes?: string): Promise<ComplianceTask> {
    const task = await this.findOne(id);
    task.status = TaskStatus.RESOLVED;
    task.resolvedAt = new Date();
    if (resolutionNotes) {
      task.resolutionNotes = resolutionNotes;
    }
    return this.taskRepository.save(task);
  }

  async cancel(id: string): Promise<ComplianceTask> {
    const task = await this.findOne(id);
    task.status = TaskStatus.CANCELLED;
    return this.taskRepository.save(task);
  }

  async getTaskStats(batchId: string): Promise<{
    total: number;
    pending: number;
    inProgress: number;
    resolved: number;
    cancelled: number;
    critical: number;
  }> {
    const tasks = await this.findByBatch(batchId);

    return {
      total: tasks.length,
      pending: tasks.filter(t => t.status === TaskStatus.PENDING).length,
      inProgress: tasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length,
      resolved: tasks.filter(t => t.status === TaskStatus.RESOLVED).length,
      cancelled: tasks.filter(t => t.status === TaskStatus.CANCELLED).length,
      critical: tasks.filter(t => t.priority === TaskPriority.CRITICAL || t.priority === TaskPriority.HIGH).length,
    };
  }
}
