import { db } from '../database/database';
import { BatteryStateMachine } from './batteryStateMachine';
import {
  Battery,
  CabinetSlot,
  Transaction,
  ExceptionRecord,
  PendingTask,
  TransactionType,
  TransactionStatus,
  ExceptionType,
  LendRequest,
  ReturnRequest,
  MaintenanceRequest,
  ScrapRequest,
  SlotStatus,
} from '../types';

export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  exceptionRecord?: ExceptionRecord;
  pendingTask?: PendingTask;
  needsManualReview: boolean;
}

export class BatteryService {
  async createBattery(batteryCode: string, maxCycleCount: number = 1000): Promise<ServiceResult<Battery>> {
    try {
      const existing = await db.getBatteryByCode(batteryCode);
      if (existing) {
        return {
          success: false,
          error: '电池编号已存在',
          needsManualReview: false,
        };
      }

      const battery = await db.createBattery(batteryCode, maxCycleCount);
      return {
        success: true,
        data: battery,
        needsManualReview: false,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        needsManualReview: false,
      };
    }
  }

  async createCabinetSlot(cabinetId: string, slotNumber: number): Promise<ServiceResult<CabinetSlot>> {
    try {
      const existing = await db.getSlot(cabinetId, slotNumber);
      if (existing) {
        return {
          success: false,
          error: '柜格已存在',
          needsManualReview: false,
        };
      }

      const slot = await db.createCabinetSlot(cabinetId, slotNumber);
      return {
        success: true,
        data: slot,
        needsManualReview: false,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        needsManualReview: false,
      };
    }
  }

  async placeBatteryInSlot(
    batteryCode: string,
    cabinetId: string,
    slotNumber: number
  ): Promise<ServiceResult<{ battery: Battery; slot: CabinetSlot }>> {
    const battery = await db.getBatteryByCode(batteryCode);
    if (!battery) {
      const exception = await db.createExceptionRecord(
        ExceptionType.BATTERY_NOT_FOUND,
        `电池 ${batteryCode} 不存在`,
        { batteryCode, cabinetId, slotNumber },
        null,
        batteryCode,
        null
      );
      const task = await db.createPendingTask(
        'BATTERY_INSPECTION',
        batteryCode,
        'BATTERY',
        'HIGH',
        { batteryCode, cabinetId, slotNumber, action: 'place_battery' }
      );
      return {
        success: false,
        error: '电池不存在',
        exceptionRecord: exception,
        pendingTask: task,
        needsManualReview: true,
      };
    }

    const slot = await db.getSlot(cabinetId, slotNumber);
    if (!slot) {
      const exception = await db.createExceptionRecord(
        ExceptionType.SLOT_NOT_FOUND,
        `柜格 ${cabinetId}-${slotNumber} 不存在`,
        { batteryCode, cabinetId, slotNumber, batteryId: battery.id },
        null,
        batteryCode,
        null
      );
      return {
        success: false,
        error: '柜格不存在',
        exceptionRecord: exception,
        needsManualReview: true,
      };
    }

    if (battery.currentSlotId !== null) {
      const currentSlot = await db.getSlotById(battery.currentSlotId);
      const exception = await db.createExceptionRecord(
        ExceptionType.STATE_MISMATCH,
        `电池 ${batteryCode} 已在其他柜格中`,
        {
          batteryCode,
          currentSlot: currentSlot
            ? { cabinetId: currentSlot.cabinetId, slotNumber: currentSlot.slotNumber }
            : battery.currentSlotId,
          targetSlot: { cabinetId, slotNumber },
        },
        null,
        batteryCode,
        slot.id
      );
      const task = await db.createPendingTask(
        'MANUAL_REVIEW',
        battery.id,
        'BATTERY',
        'HIGH',
        { reason: '电池已在其他柜格' }
      );
      return {
        success: false,
        error: '电池已在其他柜格中',
        exceptionRecord: exception,
        pendingTask: task,
        needsManualReview: true,
      };
    }

    if (slot.batteryId !== null) {
      const exception = await db.createExceptionRecord(
        ExceptionType.UNEXPECTED_OCCUPIED,
        `柜格 ${cabinetId}-${slotNumber} 已被占用`,
        {
          batteryCode,
          slotId: slot.id,
          existingBatteryId: slot.batteryId,
        },
        null,
        batteryCode,
        slot.id
      );
      const task = await db.createPendingTask(
        'SLOT_CLEANUP',
        slot.id,
        'SLOT',
        'MEDIUM',
        { reason: '柜格被意外占用' }
      );
      return {
        success: false,
        error: '柜格已被占用',
        exceptionRecord: exception,
        pendingTask: task,
        needsManualReview: true,
      };
    }

    battery.currentSlotId = slot.id;
    slot.batteryId = battery.id;
    slot.status = SlotStatus.OCCUPIED;

    const updatedBattery = await db.updateBattery(battery);
    const updatedSlot = await db.updateSlot(slot);

    return {
      success: true,
      data: { battery: updatedBattery, slot: updatedSlot },
      needsManualReview: false,
    };
  }

  async lendBattery(request: LendRequest): Promise<ServiceResult<Transaction>> {
    const transaction = await db.createTransaction(
      TransactionType.LEND,
      request.batteryCode,
      request.userId,
      request.cabinetId,
      request.slotNumber
    );

    const battery = await db.getBatteryByCode(request.batteryCode);
    if (!battery) {
      const exception = await db.createExceptionRecord(
        ExceptionType.BATTERY_NOT_FOUND,
        `借出操作：电池 ${request.batteryCode} 不存在`,
        { ...request, action: 'lend' },
        transaction.id,
        request.batteryCode,
        null
      );
      const task = await db.createPendingTask(
        'MANUAL_REVIEW',
        transaction.id,
        'TRANSACTION',
        'HIGH',
        { ...request, action: 'lend', reason: '电池不存在' }
      );
      transaction.status = TransactionStatus.FAILED;
      transaction.completedAt = new Date().toISOString();
      await db.updateTransaction(transaction);
      return {
        success: false,
        error: '电池不存在',
        exceptionRecord: exception,
        pendingTask: task,
        needsManualReview: true,
      };
    }

    const slot = await db.getSlot(request.cabinetId, request.slotNumber);
    if (!slot) {
      const exception = await db.createExceptionRecord(
        ExceptionType.SLOT_NOT_FOUND,
        `借出操作：柜格 ${request.cabinetId}-${request.slotNumber} 不存在`,
        { ...request, batteryId: battery.id, action: 'lend' },
        transaction.id,
        request.batteryCode,
        null
      );
      transaction.status = TransactionStatus.FAILED;
      transaction.completedAt = new Date().toISOString();
      await db.updateTransaction(transaction);
      return {
        success: false,
        error: '柜格不存在',
        exceptionRecord: exception,
        needsManualReview: true,
      };
    }

    const stateValidation = BatteryStateMachine.validateLendTransition(battery.status);
    const slotValidation = BatteryStateMachine.validateSlotForLend(
      slot.status,
      battery.id,
      slot.batteryId
    );

    let shouldCreateException = false;
    let exceptionType: ExceptionType | null = null;
    let errorMessage = '';

    if (!stateValidation.success) {
      shouldCreateException = true;
      exceptionType = ExceptionType.INVALID_TRANSITION;
      errorMessage = stateValidation.reason;
    } else if (!slotValidation.success) {
      shouldCreateException = true;
      exceptionType = ExceptionType.SLOT_MISMATCH;
      errorMessage = slotValidation.reason;
    }

    if (shouldCreateException && exceptionType) {
      const exception = await db.createExceptionRecord(
        exceptionType,
        errorMessage,
        {
          ...request,
          batteryId: battery.id,
          batteryStatus: battery.status,
          slotId: slot.id,
          slotStatus: slot.status,
          slotBatteryId: slot.batteryId,
        },
        transaction.id,
        request.batteryCode,
        slot.id
      );

      const needsReview = stateValidation.needsManualReview || slotValidation.needsManualReview;
      let pendingTask: PendingTask | undefined;

      if (needsReview) {
        pendingTask = await db.createPendingTask(
          'MANUAL_REVIEW',
          transaction.id,
          'TRANSACTION',
          'HIGH',
          {
            reason: errorMessage,
            batteryStatus: battery.status,
            slotStatus: slot.status,
          }
        );
      }

      transaction.status = needsReview ? TransactionStatus.PENDING_REVIEW : TransactionStatus.FAILED;
      transaction.completedAt = new Date().toISOString();
      await db.updateTransaction(transaction);

      return {
        success: false,
        error: errorMessage,
        exceptionRecord: exception,
        pendingTask,
        needsManualReview: needsReview,
      };
    }

    const cycleCheck = BatteryStateMachine.checkCycleCount(battery.cycleCount, battery.maxCycleCount);
    if (cycleCheck.needsInspection) {
      const inspectionException = await db.createExceptionRecord(
        ExceptionType.CYCLE_COUNT_EXCEEDED,
        cycleCheck.reason,
        {
          batteryCode: request.batteryCode,
          cycleCount: battery.cycleCount,
          maxCycleCount: battery.maxCycleCount,
        },
        null,
        request.batteryCode,
        null
      );
      await db.createPendingTask(
        'BATTERY_INSPECTION',
        battery.id,
        'BATTERY',
        'MEDIUM',
        { reason: cycleCheck.reason }
      );
    }

    battery.status = stateValidation.newStatus!;
    battery.currentSlotId = null;
    slot.batteryId = null;
    slot.status = SlotStatus.EMPTY;

    await db.updateBattery(battery);
    await db.updateSlot(slot);

    transaction.status = TransactionStatus.SUCCESS;
    transaction.completedAt = new Date().toISOString();
    await db.updateTransaction(transaction);

    return {
      success: true,
      data: transaction,
      needsManualReview: false,
    };
  }

  async returnBattery(request: ReturnRequest): Promise<ServiceResult<Transaction>> {
    const transaction = await db.createTransaction(
      TransactionType.RETURN,
      request.batteryCode,
      request.userId,
      request.cabinetId,
      request.slotNumber
    );

    const battery = await db.getBatteryByCode(request.batteryCode);
    if (!battery) {
      const exception = await db.createExceptionRecord(
        ExceptionType.BATTERY_NOT_FOUND,
        `归还操作：电池 ${request.batteryCode} 不存在`,
        { ...request, action: 'return' },
        transaction.id,
        request.batteryCode,
        null
      );
      const task = await db.createPendingTask(
        'MANUAL_REVIEW',
        transaction.id,
        'TRANSACTION',
        'HIGH',
        { ...request, action: 'return', reason: '电池不存在' }
      );
      transaction.status = TransactionStatus.FAILED;
      transaction.completedAt = new Date().toISOString();
      await db.updateTransaction(transaction);
      return {
        success: false,
        error: '电池不存在',
        exceptionRecord: exception,
        pendingTask: task,
        needsManualReview: true,
      };
    }

    const slot = await db.getSlot(request.cabinetId, request.slotNumber);
    if (!slot) {
      const exception = await db.createExceptionRecord(
        ExceptionType.SLOT_NOT_FOUND,
        `归还操作：柜格 ${request.cabinetId}-${request.slotNumber} 不存在`,
        { ...request, batteryId: battery.id, action: 'return' },
        transaction.id,
        request.batteryCode,
        null
      );
      transaction.status = TransactionStatus.FAILED;
      transaction.completedAt = new Date().toISOString();
      await db.updateTransaction(transaction);
      return {
        success: false,
        error: '柜格不存在',
        exceptionRecord: exception,
        needsManualReview: true,
      };
    }

    const stateValidation = BatteryStateMachine.validateReturnTransition(battery.status);
    const slotValidation = BatteryStateMachine.validateSlotForReturn(slot.status, slot.batteryId);

    let shouldCreateException = false;
    let exceptionType: ExceptionType | null = null;
    let errorMessage = '';

    if (!stateValidation.success) {
      shouldCreateException = true;
      exceptionType = ExceptionType.STATE_MISMATCH;
      errorMessage = stateValidation.reason;
    } else if (!slotValidation.success) {
      shouldCreateException = true;
      exceptionType = ExceptionType.SLOT_MISMATCH;
      errorMessage = slotValidation.reason;
    }

    if (shouldCreateException && exceptionType) {
      const exception = await db.createExceptionRecord(
        exceptionType,
        errorMessage,
        {
          ...request,
          batteryId: battery.id,
          batteryStatus: battery.status,
          slotId: slot.id,
          slotStatus: slot.status,
          slotBatteryId: slot.batteryId,
        },
        transaction.id,
        request.batteryCode,
        slot.id
      );

      const needsReview = stateValidation.needsManualReview || slotValidation.needsManualReview;
      let pendingTask: PendingTask | undefined;

      if (needsReview) {
        pendingTask = await db.createPendingTask(
          'MANUAL_REVIEW',
          transaction.id,
          'TRANSACTION',
          'HIGH',
          {
            reason: errorMessage,
            batteryStatus: battery.status,
            slotStatus: slot.status,
          }
        );
      }

      transaction.status = needsReview ? TransactionStatus.PENDING_REVIEW : TransactionStatus.FAILED;
      transaction.completedAt = new Date().toISOString();
      await db.updateTransaction(transaction);

      return {
        success: false,
        error: errorMessage,
        exceptionRecord: exception,
        pendingTask,
        needsManualReview: needsReview,
      };
    }

    battery.status = stateValidation.newStatus!;
    battery.currentSlotId = slot.id;
    battery.cycleCount += 1;
    slot.batteryId = battery.id;
    slot.status = SlotStatus.OCCUPIED;

    await db.updateBattery(battery);
    await db.updateSlot(slot);

    const cycleCheck = BatteryStateMachine.checkCycleCount(battery.cycleCount, battery.maxCycleCount);
    if (cycleCheck.needsInspection) {
      await db.createExceptionRecord(
        ExceptionType.CYCLE_COUNT_EXCEEDED,
        cycleCheck.reason,
        {
          batteryCode: request.batteryCode,
          cycleCount: battery.cycleCount,
          maxCycleCount: battery.maxCycleCount,
        },
        null,
        request.batteryCode,
        null
      );
      await db.createPendingTask(
        'BATTERY_INSPECTION',
        battery.id,
        'BATTERY',
        'MEDIUM',
        { reason: cycleCheck.reason }
      );
    }

    transaction.status = TransactionStatus.SUCCESS;
    transaction.completedAt = new Date().toISOString();
    await db.updateTransaction(transaction);

    return {
      success: true,
      data: transaction,
      needsManualReview: false,
    };
  }

  async sendToMaintenance(request: MaintenanceRequest): Promise<ServiceResult<Battery>> {
    const battery = await db.getBatteryByCode(request.batteryCode);
    if (!battery) {
      const exception = await db.createExceptionRecord(
        ExceptionType.BATTERY_NOT_FOUND,
        `维修操作：电池 ${request.batteryCode} 不存在`,
        { ...request, action: 'maintenance' },
        null,
        request.batteryCode,
        null
      );
      return {
        success: false,
        error: '电池不存在',
        exceptionRecord: exception,
        needsManualReview: true,
      };
    }

    const validation = BatteryStateMachine.validateMaintenanceTransition(battery.status);
    if (!validation.success) {
      const exception = await db.createExceptionRecord(
        validation.needsManualReview ? ExceptionType.MAINTENANCE_VIOLATION : ExceptionType.INVALID_TRANSITION,
        validation.reason,
        {
          batteryCode: request.batteryCode,
          batteryStatus: battery.status,
          reason: request.reason,
        },
        null,
        request.batteryCode,
        null
      );

      let pendingTask: PendingTask | undefined;
      if (validation.needsManualReview) {
        pendingTask = await db.createPendingTask(
          'MANUAL_REVIEW',
          battery.id,
          'BATTERY',
          'HIGH',
          { reason: validation.reason, batteryStatus: battery.status }
        );
      }

      return {
        success: false,
        error: validation.reason,
        exceptionRecord: exception,
        pendingTask,
        needsManualReview: validation.needsManualReview,
      };
    }

    if (battery.currentSlotId !== null) {
      const slot = await db.getSlotById(battery.currentSlotId);
      if (slot) {
        slot.batteryId = null;
        slot.status = SlotStatus.EMPTY;
        await db.updateSlot(slot);
      }
      battery.currentSlotId = null;
    }

    battery.status = validation.newStatus!;
    const updated = await db.updateBattery(battery);

    return {
      success: true,
      data: updated,
      needsManualReview: false,
    };
  }

  async completeMaintenance(batteryCode: string): Promise<ServiceResult<Battery>> {
    const battery = await db.getBatteryByCode(batteryCode);
    if (!battery) {
      const exception = await db.createExceptionRecord(
        ExceptionType.BATTERY_NOT_FOUND,
        `完成维修：电池 ${batteryCode} 不存在`,
        { batteryCode, action: 'complete_maintenance' },
        null,
        batteryCode,
        null
      );
      return {
        success: false,
        error: '电池不存在',
        exceptionRecord: exception,
        needsManualReview: true,
      };
    }

    const validation = BatteryStateMachine.validateRepairCompleteTransition(battery.status);
    if (!validation.success) {
      const exception = await db.createExceptionRecord(
        ExceptionType.MAINTENANCE_VIOLATION,
        validation.reason,
        { batteryCode, batteryStatus: battery.status },
        null,
        batteryCode,
        null
      );

      if (validation.needsManualReview) {
        await db.createPendingTask(
          'MANUAL_REVIEW',
          battery.id,
          'BATTERY',
          'MEDIUM',
          { reason: validation.reason, batteryStatus: battery.status }
        );
      }

      return {
        success: false,
        error: validation.reason,
        exceptionRecord: exception,
        needsManualReview: validation.needsManualReview,
      };
    }

    battery.status = validation.newStatus!;
    const updated = await db.updateBattery(battery);

    return {
      success: true,
      data: updated,
      needsManualReview: false,
    };
  }

  async scrapBattery(request: ScrapRequest): Promise<ServiceResult<Battery>> {
    const battery = await db.getBatteryByCode(request.batteryCode);
    if (!battery) {
      const exception = await db.createExceptionRecord(
        ExceptionType.BATTERY_NOT_FOUND,
        `报废操作：电池 ${request.batteryCode} 不存在`,
        { ...request, action: 'scrap' },
        null,
        request.batteryCode,
        null
      );
      return {
        success: false,
        error: '电池不存在',
        exceptionRecord: exception,
        needsManualReview: true,
      };
    }

    const validation = BatteryStateMachine.validateScrapTransition(battery.status);
    if (!validation.success) {
      const exception = await db.createExceptionRecord(
        ExceptionType.INVALID_TRANSITION,
        validation.reason,
        {
          batteryCode: request.batteryCode,
          batteryStatus: battery.status,
          reason: request.reason,
        },
        null,
        request.batteryCode,
        null
      );

      let pendingTask: PendingTask | undefined;
      if (validation.needsManualReview) {
        pendingTask = await db.createPendingTask(
          'MANUAL_REVIEW',
          battery.id,
          'BATTERY',
          'HIGH',
          { reason: validation.reason, batteryStatus: battery.status }
        );
      }

      return {
        success: false,
        error: validation.reason,
        exceptionRecord: exception,
        pendingTask,
        needsManualReview: validation.needsManualReview,
      };
    }

    if (battery.currentSlotId !== null) {
      const slot = await db.getSlotById(battery.currentSlotId);
      if (slot) {
        slot.batteryId = null;
        slot.status = SlotStatus.EMPTY;
        await db.updateSlot(slot);
      }
      battery.currentSlotId = null;
    }

    battery.status = validation.newStatus!;
    const updated = await db.updateBattery(battery);

    return {
      success: true,
      data: updated,
      needsManualReview: false,
    };
  }

  async getUnresolvedExceptions(): Promise<ExceptionRecord[]> {
    return db.getUnresolvedExceptions();
  }

  async getPendingTasks(): Promise<PendingTask[]> {
    return db.getPendingTasks();
  }
}

export const batteryService = new BatteryService();
