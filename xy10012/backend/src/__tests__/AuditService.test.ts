import { AuditService } from '../services/AuditService';
import { AuditAction, EntityType } from '@prisma/client';
import { RequestContext } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

jest.mock('../config/database', () => ({
  prisma: {
    auditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

const mockPrisma = require('../config/database').prisma;

describe('AuditService', () => {
  let auditService: AuditService;
  let context: RequestContext;

  beforeEach(() => {
    auditService = new AuditService();
    context = new RequestContext({
      requestId: uuidv4(),
      userId: 'test-user-id',
      ipAddress: '127.0.0.1',
      userAgent: 'test-agent',
    });
    jest.clearAllMocks();
  });

  describe('record', () => {
    it('should throw error when userId is missing', async () => {
      const contextWithoutUser = new RequestContext({
        requestId: uuidv4(),
      });

      await expect(
        auditService.record(
          {
            entityType: EntityType.TASK,
            entityId: 'task-1',
            action: AuditAction.CREATE,
            newState: { title: 'test' },
          },
          contextWithoutUser
        )
      ).rejects.toThrow('User ID is required');
    });

    it('should create audit log with all context data', async () => {
      mockPrisma.auditLog.create.mockResolvedValue({});

      await auditService.record(
        {
          entityType: EntityType.TASK,
          entityId: 'task-1',
          action: AuditAction.CREATE,
          previousState: { title: 'old' },
          newState: { title: 'new' },
          reason: '测试原因',
        },
        context
      );

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            entityType: EntityType.TASK,
            entityId: 'task-1',
            action: AuditAction.CREATE,
            userId: 'test-user-id',
            ipAddress: '127.0.0.1',
            userAgent: 'test-agent',
            reason: '测试原因',
            requestId: context.requestId,
          }),
        })
      );
    });
  });

  describe('getEntityHistory', () => {
    it('should return logs with pagination', async () => {
      const mockLogs = [
        { id: 'log-1', action: AuditAction.CREATE },
        { id: 'log-2', action: AuditAction.UPDATE },
      ];

      mockPrisma.auditLog.findMany.mockResolvedValue(mockLogs);
      mockPrisma.auditLog.count.mockResolvedValue(2);

      const result = await auditService.getEntityHistory(
        EntityType.TASK,
        'task-1',
        10,
        0
      );

      expect(result.logs).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { entityType: EntityType.TASK, entityId: 'task-1' },
          skip: 0,
          take: 10,
          orderBy: { timestamp: 'desc' },
        })
      );
    });
  });

  describe('replayEntityChanges', () => {
    it('should replay changes in chronological order', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          action: AuditAction.CREATE,
          timestamp: new Date('2024-01-01T10:00:00'),
          userId: 'user-1',
          newState: { title: '初始标题', version: 1 },
        },
        {
          id: 'log-2',
          action: AuditAction.UPDATE,
          timestamp: new Date('2024-01-01T11:00:00'),
          userId: 'user-2',
          newState: { title: '更新后的标题' },
        },
        {
          id: 'log-3',
          action: AuditAction.UPDATE,
          timestamp: new Date('2024-01-01T12:00:00'),
          userId: 'user-1',
          newState: { status: 'COMPLETED' },
        },
      ];

      mockPrisma.auditLog.findMany.mockResolvedValue(mockLogs);

      const history = await auditService.replayEntityChanges(
        EntityType.TASK,
        'task-1'
      );

      expect(history).toHaveLength(3);
      expect(history[0].state.title).toBe('初始标题');
      expect(history[1].state.title).toBe('更新后的标题');
      expect(history[2].state.status).toBe('COMPLETED');
    });

    it('should handle rollback actions', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          action: AuditAction.CREATE,
          timestamp: new Date(),
          userId: 'user-1',
          newState: { title: 'v1' },
        },
        {
          id: 'log-2',
          action: AuditAction.UPDATE,
          timestamp: new Date(),
          userId: 'user-1',
          newState: { title: 'v2' },
        },
        {
          id: 'log-3',
          action: AuditAction.ROLLBACK,
          timestamp: new Date(),
          userId: 'user-1',
          newState: { title: 'v1' },
        },
      ];

      mockPrisma.auditLog.findMany.mockResolvedValue(mockLogs);

      const history = await auditService.replayEntityChanges(
        EntityType.TASK,
        'task-1'
      );

      expect(history[2].state.title).toBe('v1');
    });
  });
});