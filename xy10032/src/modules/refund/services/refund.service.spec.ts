import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { RefundService } from './refund.service';
import { Refund } from '../refund.entity';
import { StateMachineService } from './state-machine.service';
import { RefundHistoryService } from './refund-history.service';
import { PaymentGatewayService } from './payment-gateway.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { RefundStatus } from '../../../common/enums/refund-status.enum';
import { Role } from '../../../common/enums/role.enum';
import {
  DuplicateRefundException,
  InvalidStatusTransitionException,
} from '../../../common/exceptions/business.exception';

describe('RefundService', () => {
  let service: RefundService;
  let mockRefundRepository: any;
  let mockDataSource: any;
  let mockAuditLogService: any;
  let mockRefundHistoryService: any;
  let mockStateMachineService: any;
  let mockPaymentGatewayService: any;

  beforeEach(async () => {
    mockRefundRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    mockDataSource = {
      createQueryRunner: jest.fn(),
    };

    mockAuditLogService = {
      create: jest.fn(),
    };

    mockRefundHistoryService = {
      createHistory: jest.fn(),
    };

    mockStateMachineService = {
      validateTransition: jest.fn(),
      getStatusDescription: jest.fn(),
    };

    mockPaymentGatewayService = {
      processRefund: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefundService,
        {
          provide: getRepositoryToken(Refund),
          useValue: mockRefundRepository,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: AuditLogService,
          useValue: mockAuditLogService,
        },
        {
          provide: RefundHistoryService,
          useValue: mockRefundHistoryService,
        },
        {
          provide: StateMachineService,
          useValue: mockStateMachineService,
        },
        {
          provide: PaymentGatewayService,
          useValue: mockPaymentGatewayService,
        },
      ],
    }).compile();

    service = module.get<RefundService>(RefundService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateRefundNo', () => {
    it('should generate refund number with correct format', () => {
      const refundNo = service.generateRefundNo();
      expect(refundNo).toMatch(/^RF\d{14}$/);
    });
  });

  describe('create', () => {
    const createDto = {
      orderNo: 'TEST001',
      amount: 100.00,
      currency: 'CNY',
      refundMethod: 'original_payment',
      reason: 'Test',
      remark: '',
    };

    it('should create refund when no duplicate exists', async () => {
      mockRefundRepository.find.mockResolvedValue([]);
      mockRefundRepository.create.mockReturnValue({
        ...createDto,
        refundNo: 'RF20240101123456',
        createdById: 'user-1',
        status: RefundStatus.DRAFT,
      });
      mockRefundRepository.save.mockResolvedValue({
        id: 'refund-1',
        ...createDto,
        refundNo: 'RF20240101123456',
        createdById: 'user-1',
        status: RefundStatus.DRAFT,
      });

      const result = await service.create(createDto, 'user-1', 'testuser');

      expect(result).toBeDefined();
      expect(result.status).toBe(RefundStatus.DRAFT);
      expect(mockAuditLogService.create).toHaveBeenCalled();
    });

    it('should throw DuplicateRefundException when duplicate exists', async () => {
      mockRefundRepository.find.mockResolvedValue([
        { id: 'existing', orderNo: 'TEST001', status: RefundStatus.PENDING },
      ]);

      await expect(
        service.create(createDto, 'user-1', 'testuser'),
      ).rejects.toThrow(DuplicateRefundException);
    });
  });

  describe('findAll', () => {
    it('should return paginated results', async () => {
      const queryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      mockRefundRepository.createQueryBuilder.mockReturnValue(queryBuilder);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });
  });
});
