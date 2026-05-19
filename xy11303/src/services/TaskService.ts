import { CleaningTaskModel } from '../models/CleaningTaskModel';
import { OrderModel } from '../models/OrderModel';
import { UserModel } from '../models/UserModel';
import { TaskStatus, UserRole, CleaningTask, User } from '../types';
import { now } from '../models/database';

export interface AssignTaskRequest {
  orderId: string;
  cleanerId: string;
  scheduledDate: string;
  deadline: string;
  requiredPhotos?: number;
  operatorId: string;
}

export interface AssignTaskResult {
  success: boolean;
  task?: CleaningTask;
  error?: string;
  isDuplicate: boolean;
}

export class TaskService {
  static async assignTask(request: AssignTaskRequest): Promise<AssignTaskResult> {
    const order = OrderModel.getById(request.orderId);
    if (!order) {
      return { success: false, error: '订单不存在', isDuplicate: false };
    }

    const cleaner = UserModel.getById(request.cleanerId);
    if (!cleaner || cleaner.role !== UserRole.CLEANER || !cleaner.isActive) {
      return { success: false, error: '保洁员不存在或无效', isDuplicate: false };
    }

    const existingTasks = CleaningTaskModel.list({
      cleanerId: request.cleanerId,
      startDate: request.scheduledDate.split('T')[0],
      endDate: request.scheduledDate.split('T')[0]
    });

    const duplicateTask = existingTasks.find(t => 
      t.orderId === request.orderId && 
      t.status !== TaskStatus.CANCELLED
    );
    
    if (duplicateTask) {
      return { success: true, task: duplicateTask, isDuplicate: true };
    }

    const task = CleaningTaskModel.create({
      orderId: request.orderId,
      homestayId: order.homestayId,
      homestayName: order.homestayName,
      cleanerId: request.cleanerId,
      cleanerName: cleaner.name,
      cleanerPhone: cleaner.phone,
      scheduledDate: request.scheduledDate,
      deadline: request.deadline,
      requiredPhotos: request.requiredPhotos || 5
    });

    CleaningTaskModel.update(task.id, {
      status: TaskStatus.ASSIGNED,
      assignedAt: now()
    });

    const updatedTask = CleaningTaskModel.getById(task.id)!;

    return { success: true, task: updatedTask, isDuplicate: false };
  }

  static async startTask(taskId: string, operatorId: string): Promise<{ success: boolean; task?: CleaningTask; error?: string }> {
    const task = CleaningTaskModel.getById(taskId);
    if (!task) {
      return { success: false, error: '任务不存在' };
    }

    if (task.status !== TaskStatus.ASSIGNED) {
      return { success: false, error: '任务状态不允许开始' };
    }

    CleaningTaskModel.update(taskId, {
      status: TaskStatus.IN_PROGRESS,
      startedAt: now()
    });

    return { success: true, task: CleaningTaskModel.getById(taskId)! };
  }

  static async submitTask(taskId: string, operatorId: string): Promise<{ success: boolean; task?: CleaningTask; error?: string }> {
    const task = CleaningTaskModel.getById(taskId);
    if (!task) {
      return { success: false, error: '任务不存在' };
    }

    if (task.status !== TaskStatus.IN_PROGRESS) {
      return { success: false, error: '任务状态不允许提交' };
    }

    CleaningTaskModel.update(taskId, {
      status: TaskStatus.SUBMITTED,
      submittedAt: now()
    });

    return { success: true, task: CleaningTaskModel.getById(taskId)! };
  }

  static async approveTask(taskId: string, operatorId: string): Promise<{ success: boolean; task?: CleaningTask; error?: string }> {
    const task = CleaningTaskModel.getById(taskId);
    if (!task) {
      return { success: false, error: '任务不存在' };
    }

    if (task.status !== TaskStatus.SUBMITTED) {
      return { success: false, error: '任务状态不允许验收' };
    }

    CleaningTaskModel.update(taskId, {
      status: TaskStatus.APPROVED,
      approvedAt: now()
    });

    return { success: true, task: CleaningTaskModel.getById(taskId)! };
  }

  static async rejectTask(taskId: string, operatorId: string): Promise<{ success: boolean; task?: CleaningTask; error?: string }> {
    const task = CleaningTaskModel.getById(taskId);
    if (!task) {
      return { success: false, error: '任务不存在' };
    }

    if (task.status !== TaskStatus.SUBMITTED) {
      return { success: false, error: '任务状态不允许驳回' };
    }

    CleaningTaskModel.update(taskId, {
      status: TaskStatus.REJECTED
    });

    return { success: true, task: CleaningTaskModel.getById(taskId)! };
  }

  static async completeTask(taskId: string, operatorId: string): Promise<{ success: boolean; task?: CleaningTask; error?: string }> {
    const task = CleaningTaskModel.getById(taskId);
    if (!task) {
      return { success: false, error: '任务不存在' };
    }

    if (task.status !== TaskStatus.APPROVED) {
      return { success: false, error: '任务状态不允许完成' };
    }

    CleaningTaskModel.update(taskId, {
      status: TaskStatus.COMPLETED,
      completedAt: now()
    });

    return { success: true, task: CleaningTaskModel.getById(taskId)! };
  }

  static getTask(taskId: string): CleaningTask | null {
    return CleaningTaskModel.getById(taskId);
  }

  static listTasks(filters: { cleanerId?: string; status?: TaskStatus; startDate?: string; endDate?: string } = {}): CleaningTask[] {
    return CleaningTaskModel.list(filters);
  }
}
