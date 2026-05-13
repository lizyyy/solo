/**
 * API 层 - 模拟真实后端请求
 * 
 * 架构说明：
 * - 统一封装所有数据请求，支持加载状态和错误处理
 * - 通过延迟模拟真实网络请求，便于测试加载状态
 * - 统一响应格式，便于错误处理和类型推断
 * 
 * 可升级为真实后端：
 * 1. 将所有实现替换为 fetch/axios 调用
 * 2. 添加统一的请求拦截器（认证、token等）
 * 3. 添加错误重试和降级策略
 */

import type { Building, Resident, SignRecord, CostScheme, PublicityComment, BuildingVersion, BusinessPhase } from '../types';
import { ElevatorService } from '../services/ElevatorService';

interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const BuildingApi = {
  async getAll(): Promise<ApiResponse<Building[]>> {
    await delay(300);
    return {
      success: true,
      data: ElevatorService.getAllBuildings(),
    };
  },

  async getById(id: string): Promise<ApiResponse<Building | undefined>> {
    await delay(200);
    return {
      success: true,
      data: ElevatorService.getBuilding(id),
    };
  },

  async create(building: Omit<Building, 'id' | 'createdAt' | 'updatedAt' | 'currentEffectiveVersionId'>): Promise<ApiResponse<Building>> {
    await delay(500);
    return {
      success: true,
      data: ElevatorService.createBuilding(building),
    };
  },

  async update(id: string, updates: Partial<Building>): Promise<ApiResponse<Building | undefined>> {
    await delay(300);
    return {
      success: true,
      data: ElevatorService.updateBuilding(id, updates),
    };
  },
};

export const ResidentApi = {
  async getByBuilding(buildingId: string): Promise<ApiResponse<Resident[]>> {
    await delay(200);
    return {
      success: true,
      data: ElevatorService.getResidents(buildingId),
    };
  },

  async create(resident: Omit<Resident, 'id' | 'createdAt' | 'updatedAt'>): Promise<ApiResponse<Resident>> {
    await delay(400);
    return {
      success: true,
      data: ElevatorService.createResident(resident),
    };
  },
};

export const SignRecordApi = {
  async getByBuilding(buildingId: string, versionId?: string): Promise<ApiResponse<SignRecord[]>> {
    await delay(200);
    return {
      success: true,
      data: ElevatorService.getSignRecords(buildingId, versionId),
    };
  },

  async getLatestByResident(residentId: string, buildingId: string): Promise<ApiResponse<SignRecord | undefined>> {
    await delay(100);
    return {
      success: true,
      data: ElevatorService.getResidentLatestSign(residentId, buildingId),
    };
  },

  async create(record: Omit<SignRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<ApiResponse<SignRecord>> {
    await delay(400);
    return {
      success: true,
      data: ElevatorService.createSignRecord(record),
    };
  },

  async withdraw(recordId: string, handler: string, stillCounted: boolean = false): Promise<ApiResponse<SignRecord | undefined>> {
    await delay(400);
    return {
      success: true,
      data: ElevatorService.withdrawSign(recordId, handler, stillCounted),
    };
  },

  async updateObjectionStatus(
    recordId: string,
    status: 'processing' | 'resolved' | 'rejected',
    handler: string
  ): Promise<ApiResponse<SignRecord | undefined>> {
    await delay(300);
    return {
      success: true,
      data: ElevatorService.updateObjectionStatus(recordId, status, handler),
    };
  },
};

export const VersionApi = {
  async getByBuilding(buildingId: string): Promise<ApiResponse<BuildingVersion[]>> {
    await delay(200);
    return {
      success: true,
      data: ElevatorService.getVersions(buildingId),
    };
  },

  async create(
    buildingId: string,
    versionName: string,
    description: string,
    changeLog: string,
    createdBy: string
  ): Promise<ApiResponse<BuildingVersion>> {
    await delay(600);
    return {
      success: true,
      data: ElevatorService.createVersion(buildingId, versionName, description, changeLog, createdBy),
    };
  },
};

export const CostSchemeApi = {
  async getByBuilding(buildingId: string, versionId?: string): Promise<ApiResponse<CostScheme[]>> {
    await delay(200);
    return {
      success: true,
      data: ElevatorService.getCostSchemes(buildingId, versionId),
    };
  },

  async create(scheme: Omit<CostScheme, 'id' | 'createdAt'>): Promise<ApiResponse<CostScheme>> {
    await delay(400);
    return {
      success: true,
      data: ElevatorService.createCostScheme(scheme),
    };
  },
};

export const CommentApi = {
  async getByBuilding(buildingId: string, versionId?: string): Promise<ApiResponse<PublicityComment[]>> {
    await delay(200);
    return {
      success: true,
      data: ElevatorService.getComments(buildingId, versionId),
    };
  },

  async create(comment: Omit<PublicityComment, 'id' | 'commentDate'>): Promise<ApiResponse<PublicityComment>> {
    await delay(400);
    return {
      success: true,
      data: ElevatorService.createComment(comment),
    };
  },

  async respond(commentId: string, response: string, responder: string): Promise<ApiResponse<PublicityComment | undefined>> {
    await delay(300);
    return {
      success: true,
      data: ElevatorService.respondToComment(commentId, response, responder),
    };
  },
};

export const StatsApi = {
  async getProgress(buildingId: string): Promise<ApiResponse<ReturnType<typeof ElevatorService.getProgressStats>>> {
    await delay(200);
    return {
      success: true,
      data: ElevatorService.getProgressStats(buildingId),
    };
  },

  async canAdvancePhase(buildingId: string, nextPhase: BusinessPhase): Promise<ApiResponse<{ can: boolean; reason?: string }>> {
    await delay(100);
    return {
      success: true,
      data: ElevatorService.canAdvancePhase(buildingId, nextPhase),
    };
  },
};

export const ExportApi = {
  async exportData(buildingId: string): Promise<ApiResponse<string>> {
    await delay(800);
    return {
      success: true,
      data: ElevatorService.exportData(buildingId),
    };
  },
};

export const AppApi = {
  async initializeDemo(): Promise<ApiResponse<void>> {
    await delay(500);
    ElevatorService.initializeDemoData();
    return { success: true, data: undefined };
  },
};

export default {
  building: BuildingApi,
  resident: ResidentApi,
  signRecord: SignRecordApi,
  version: VersionApi,
  costScheme: CostSchemeApi,
  comment: CommentApi,
  stats: StatsApi,
  export: ExportApi,
  app: AppApi,
};
