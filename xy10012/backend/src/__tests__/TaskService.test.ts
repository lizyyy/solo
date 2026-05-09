import { TaskService } from '../services/TaskService';
import { prisma, transaction } from '../config/database';
import { RequestContext } from '../utils/logger';
import { TaskPriority, TaskStatus } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

jest.mock('../config/database', () => ({
  prisma: {
    task: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    taskVersion: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  },
  transaction: jest.fn(),
}));

jest.mock('../config/redis', () => ({
  redis: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  },
}));

jest.mock('../services/AuditService', () => ({
  auditService: {
    record: jest.fn(),
  },
}));

jest.mock('../services/OutboxService', () => ({
  outboxService: {
    enqueueEvent: jest.fn(),
  },
}));

jest.mock('../services/LockService', () => ({
  lockService: {
    checkVersion: jest.fn(),
    acquireOptimisticLock: jest.fn(),
    releaseOptimisticLock: jest.fn(),
  },
}));

jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
  RequestContext: class {
    requestId: string;
    userId?: string;
    constructor(opts: any) {
      this.requestId = opts.requestId;
      this.userId = opts.userId;
    }
  },
}));

const mockTransaction = transaction as jest.MockedFunction<typeof transaction>;
const mockPrisma = prisma as any;

describe('TaskService', () => {
  let taskService: TaskService;
  let context: RequestContext;

  beforeEach(() => {
    taskService = new TaskService();
    context = new RequestContext({
      requestId: uuidv4(),
      userId: 'test-user-id',
    });
    jest.clearAllMocks();
  });

  describe('createTask', () => {
    it('should create a new task when not duplicate', async () => {
      const mockTask = {
        id: 'task-1',
        customerId: 'customer-1',
        title: '测试任务',
        description: '测试描述',
        status: TaskStatus.PENDING,
        priority: TaskPriority.MEDIUM,
        version: 1,
      };

      mockTransaction.mockImplementation(async (fn: any) => {
        mockPrisma.task.findFirst.mockResolvedValue(null);
        mockPrisma.task.create.mockResolvedValue(mockTask);
        return fn({
          task: {
            findFirst: mockPrisma.task.findFirst,
            create: mockPrisma.task.create,
          },
          taskVersion: {
            create: mockPrisma.taskVersion.create,
          },
        });
      });

      const result = await taskService.createTask(
        {
          customerId: 'customer-1',
          title: '测试任务',
          orderNumber: 'ORD001',
        },
        context
      );

      expect(result.isDuplicate).toBe(false);
      expect(mockPrisma.task.create).toHaveBeenCalled();
    });

    it('should detect duplicate task by orderNumber', async () => {
      const existingTask = {
        id: 'existing-task',
        customerId: 'customer-1',
        orderNumber: 'ORD001',
        title: '已存在的任务',
      };

      mockTransaction.mockImplementation(async (fn: any) => {
        mockPrisma.task.findFirst.mockResolvedValue(existingTask);
        return fn({
          task: {
            findFirst: mockPrisma.task.findFirst,
          },
        });
      });

      const result = await taskService.createTask(
        {
          customerId: 'customer-1',
          title: '重复任务',
          orderNumber: 'ORD001',
        },
        context
      );

      expect(result.isDuplicate).toBe(true);
      expect(result.task.id).toBe('existing-task');
    });
  });

  describe('listTasks', () => {
    it('should return paginated tasks', async () => {
      const mockTasks = [
        { id: 'task-1', title: 'Task 1' },
        { id: 'task-2', title: 'Task 2' },
      ];

      mockPrisma.task.findMany.mockResolvedValue(mockTasks);
      mockPrisma.task.count.mockResolvedValue(2);

      const result = await taskService.listTasks({
        page: 1,
        pageSize: 20,
      });

      expect(result.tasks).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
      expect(mockPrisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 20,
        })
      );
    });

    it('should apply filters correctly', async () => {
      mockPrisma.task.findMany.mockResolvedValue([]);
      mockPrisma.task.count.mockResolvedValue(0);

      await taskService.listTasks({
        status: [TaskStatus.PENDING],
        priority: [TaskPriority.HIGH],
        assigneeId: 'user-1',
        search: '测试',
      });

      expect(mockPrisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: [TaskStatus.PENDING] },
            priority: { in: [TaskPriority.HIGH] },
            assigneeId: 'user-1',
            OR: expect.any(Array),
          }),
        })
      );
    });
  });
});