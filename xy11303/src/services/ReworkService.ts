import { ReworkModel } from '../models/ReworkModel';
import { CleaningTaskModel } from '../models/CleaningTaskModel';
import { UserModel } from '../models/UserModel';
import { TaskStatus, User, Rework } from '../types';
import { now } from '../models/database';

export interface CreateReworkRequest {
  taskId: string;
  reason: string;
  requesterId: string;
  deadline: string;
  photosRequired?: number;
}

export interface CreateReworkResult {
  success: boolean;
  rework?: Rework;
  error?: string;
  isDuplicate: boolean;
}

export class ReworkService {
  static async createRework(request: CreateReworkRequest): Promise<CreateReworkResult> {
    const task = CleaningTaskModel.getById(request.taskId);
    if (!task) {
      return { success: false, error: '任务不存在', isDuplicate: false };
    }

    const requester = UserModel.getById(request.requesterId);
    if (!requester || !requester.isActive) {
      return { success: false, error: '请求人不存在或无效', isDuplicate: false };
    }

    const cleaner = UserModel.getById(task.cleanerId!);
    if (!cleaner || !cleaner.isActive) {
      return { success: false, error: '保洁员不存在或无效', isDuplicate: false };
    }

    const existingReworks = ReworkModel.getByTaskId(request.taskId);
    const pendingRework = existingReworks.find(r => 
      r.status !== TaskStatus.COMPLETED && r.status !== TaskStatus.CANCELLED
    );
    
    if (pendingRework) {
      return { success: true, rework: pendingRework, isDuplicate: true };
    }

    const rework = ReworkModel.create({
      taskId: request.taskId,
      orderId: task.orderId,
      reason: request.reason,
      requesterId: request.requesterId,
      requesterName: requester.name,
      cleanerId: task.cleanerId!,
      cleanerName: task.cleanerName!,
      deadline: request.deadline,
      photosRequired: request.photosRequired || 3
    });

    return { success: true, rework, isDuplicate: false };
  }

  static async startRework(reworkId: string, operatorId: string): Promise<{ success: boolean; rework?: Rework; error?: string }> {
    const rework = ReworkModel.getById(reworkId);
    if (!rework) {
      return { success: false, error: '返工任务不存在' };
    }

    if (rework.status !== TaskStatus.ASSIGNED) {
      return { success: false, error: '返工任务状态不允许开始' };
    }

    ReworkModel.update(reworkId, {
      status: TaskStatus.IN_PROGRESS,
      startedAt: now()
    });

    return { success: true, rework: ReworkModel.getById(reworkId)! };
  }

  static async submitRework(reworkId: string, operatorId: string): Promise<{ success: boolean; rework?: Rework; error?: string }> {
    const rework = ReworkModel.getById(reworkId);
    if (!rework) {
      return { success: false, error: '返工任务不存在' };
    }

    if (rework.status !== TaskStatus.IN_PROGRESS) {
      return { success: false, error: '返工任务状态不允许提交' };
    }

    ReworkModel.update(reworkId, {
      status: TaskStatus.SUBMITTED,
      submittedAt: now()
    });

    return { success: true, rework: ReworkModel.getById(reworkId)! };
  }

  static async approveRework(reworkId: string, operatorId: string): Promise<{ success: boolean; rework?: Rework; error?: string }> {
    const rework = ReworkModel.getById(reworkId);
    if (!rework) {
      return { success: false, error: '返工任务不存在' };
    }

    if (rework.status !== TaskStatus.SUBMITTED) {
      return { success: false, error: '返工任务状态不允许验收' };
    }

    ReworkModel.update(reworkId, {
      status: TaskStatus.APPROVED,
      approvedAt: now()
    });

    return { success: true, rework: ReworkModel.getById(reworkId)! };
  }

  static async completeRework(reworkId: string, operatorId: string): Promise<{ success: boolean; rework?: Rework; error?: string }> {
    const rework = ReworkModel.getById(reworkId);
    if (!rework) {
      return { success: false, error: '返工任务不存在' };
    }

    if (rework.status !== TaskStatus.APPROVED) {
      return { success: false, error: '返工任务状态不允许完成' };
    }

    ReworkModel.update(reworkId, {
      status: TaskStatus.COMPLETED,
      completedAt: now()
    });

    return { success: true, rework: ReworkModel.getById(reworkId)! };
  }

  static getRework(reworkId: string): Rework | null {
    return ReworkModel.getById(reworkId);
  }

  static getReworksByTask(taskId: string): Rework[] {
    return ReworkModel.getByTaskId(taskId);
  }

  static listReworks(filters: { cleanerId?: string; status?: TaskStatus } = {}): Rework[] {
    return ReworkModel.list(filters);
  }
}
