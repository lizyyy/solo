/**
 * 老楼加装电梯业务服务层
 * 
 * 架构说明：
 * - 本层模拟后端服务，封装所有业务逻辑
 * - 数据持久化通过 localStorage 模拟数据库
 * - 前端组件只调用本层暴露的 API，不直接操作存储
 * 
 * 可升级为真实后端：
 * 1. 将 localStorage 替换为真实数据库调用
 * 2. 封装为 REST API 或 GraphQL 接口
 * 3. 添加权限校验、事务、审计日志等
 */

import type { Building, Resident, SignRecord, CostScheme, PublicityComment, BuildingVersion, SignStatus, BusinessPhase } from '../types';

const generateId = () => Math.random().toString(36).substr(2, 9);
const now = () => new Date().toISOString();

export class ElevatorService {
  private static get<T>(key: string): T[] {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  }

  private static set<T>(key: string, data: T[]): void {
    localStorage.setItem(key, JSON.stringify(data));
  }

  private static readonly KEYS = {
    BUILDINGS: 'elevator_buildings',
    RESIDENTS: 'elevator_residents',
    SIGN_RECORDS: 'elevator_sign_records',
    COST_SCHEMES: 'elevator_cost_schemes',
    COMMENTS: 'elevator_comments',
    VERSIONS: 'elevator_versions',
  };

  /**
   * 初始化演示数据 - 首次访问时自动创建示例楼栋
   */
  static initializeDemoData(): void {
    if (this.getAllBuildings().length > 0) return;

    const building = this.createBuilding({
      name: '阳光花园 3 号楼',
      address: '北京市朝阳区阳光花园小区',
      totalHouseholds: 12,
      totalFloors: 6,
      units: ['1单元', '2单元'],
      currentPhase: 'signing',
    });

    const version = this.createVersion(
      building.id,
      '初始版本',
      '第一版签字方案',
      '初始化楼栋信息和费用方案',
      '系统管理员'
    );

    this.updateBuilding(building.id, { currentEffectiveVersionId: version.id });

    const roomNumbers = ['101', '102', '201', '202', '301', '302', '401', '402', '501', '502', '601', '602'];
    const names = ['张三', '李四', '王五', '赵六', '钱七', '孙八', '周九', '吴十', '郑十一', '王十二', '冯十三', '陈十四'];
    
    roomNumbers.forEach((room, index) => {
      const floor = parseInt(room.charAt(0));
      this.createResident({
        buildingId: building.id,
        roomNumber: room,
        floor,
        unit: index < 6 ? '1单元' : '2单元',
        name: names[index],
        phone: `138${String(10000000 + index).slice(-8)}`,
        area: 80 + (index % 3) * 20,
        isOwner: true,
      });
    });

    this.createCostScheme({
      buildingId: building.id,
      versionId: version.id,
      name: '基础费用方案',
      description: '按楼层系数分摊方案',
      totalCost: 450000,
      allocationMethod: 'floor',
      floorCoefficients: { 1: 0.5, 2: 0.7, 3: 0.9, 4: 1.1, 5: 1.3, 6: 1.5 },
      paymentSchedule: '首付30%，安装完成付50%，验收后付20%',
      createdBy: '系统管理员',
    });

    const residents = this.getResidents(building.id);
    const statuses: SignStatus[] = ['agree', 'agree', 'agree', 'agree', 'pending', 'disagree'];
    residents.forEach((resident, index) => {
      const status = statuses[index % statuses.length];
      if (status !== 'pending') {
        this.createSignRecord({
          buildingId: building.id,
          residentId: resident.id,
          versionId: version.id,
          status,
          signDate: now(),
          objectionReason: status === 'disagree' ? '担心噪音影响' : undefined,
          objectionStatus: status === 'disagree' ? 'pending' : undefined,
          handler: '社区工作人员',
          isDuplicate: false,
          isWithdrawnButCounted: false,
        });
      }
    });
  }

  /**
   * 楼栋管理
   */
  static getAllBuildings(): Building[] {
    return this.get<Building>(this.KEYS.BUILDINGS);
  }

  static getBuilding(id: string): Building | undefined {
    return this.getAllBuildings().find(b => b.id === id);
  }

  static createBuilding(building: Omit<Building, 'id' | 'createdAt' | 'updatedAt' | 'currentEffectiveVersionId'>): Building {
    const buildings = this.getAllBuildings();
    const newBuilding: Building = {
      ...building,
      id: generateId(),
      currentEffectiveVersionId: '',
      createdAt: now(),
      updatedAt: now(),
    };
    buildings.push(newBuilding);
    this.set(this.KEYS.BUILDINGS, buildings);
    return newBuilding;
  }

  static updateBuilding(id: string, updates: Partial<Building>): Building | undefined {
    const buildings = this.getAllBuildings();
    const index = buildings.findIndex(b => b.id === id);
    if (index === -1) return undefined;
    buildings[index] = { ...buildings[index], ...updates, updatedAt: now() };
    this.set(this.KEYS.BUILDINGS, buildings);
    return buildings[index];
  }

  /**
   * 住户管理
   */
  static getResidents(buildingId: string): Resident[] {
    return this.get<Resident>(this.KEYS.RESIDENTS).filter(r => r.buildingId === buildingId);
  }

  static createResident(resident: Omit<Resident, 'id' | 'createdAt' | 'updatedAt'>): Resident {
    const residents = this.get<Resident>(this.KEYS.RESIDENTS);
    const newResident: Resident = {
      ...resident,
      id: generateId(),
      createdAt: now(),
      updatedAt: now(),
    };
    residents.push(newResident);
    this.set(this.KEYS.RESIDENTS, residents);
    return newResident;
  }

  /**
   * 签字管理
   */
  static getSignRecords(buildingId: string, versionId?: string): SignRecord[] {
    const records = this.get<SignRecord>(this.KEYS.SIGN_RECORDS).filter(r => r.buildingId === buildingId);
    return versionId ? records.filter(r => r.versionId === versionId) : records;
  }

  static getResidentLatestSign(residentId: string, buildingId: string): SignRecord | undefined {
    const records = this.getSignRecords(buildingId).filter(r => r.residentId === residentId);
    return records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  }

  static createSignRecord(record: Omit<SignRecord, 'id' | 'createdAt' | 'updatedAt'>): SignRecord {
    const records = this.get<SignRecord>(this.KEYS.SIGN_RECORDS);
    const newRecord: SignRecord = {
      ...record,
      id: generateId(),
      createdAt: now(),
      updatedAt: now(),
    };
    records.push(newRecord);
    this.set(this.KEYS.SIGN_RECORDS, records);
    return newRecord;
  }

  static withdrawSign(recordId: string, handler: string, stillCounted: boolean = false): SignRecord | undefined {
    const records = this.get<SignRecord>(this.KEYS.SIGN_RECORDS);
    const record = records.find(r => r.id === recordId);
    if (!record) return undefined;

    const withdrawnRecord: SignRecord = {
      ...record,
      id: generateId(),
      status: 'withdrawn',
      isWithdrawnButCounted: stillCounted,
      handler,
      createdAt: now(),
      updatedAt: now(),
    };
    records.push(withdrawnRecord);
    this.set(this.KEYS.SIGN_RECORDS, records);
    return withdrawnRecord;
  }

  static updateObjectionStatus(
    recordId: string,
    status: 'processing' | 'resolved' | 'rejected',
    handler: string
  ): SignRecord | undefined {
    const records = this.get<SignRecord>(this.KEYS.SIGN_RECORDS);
    const index = records.findIndex(r => r.id === recordId);
    if (index === -1) return undefined;

    records[index] = {
      ...records[index],
      objectionStatus: status,
      objectionHandler: handler,
      objectionHandleDate: now(),
      updatedAt: now(),
    };
    this.set(this.KEYS.SIGN_RECORDS, records);
    return records[index];
  }

  /**
   * 版本管理
   */
  static getVersions(buildingId: string): BuildingVersion[] {
    return this.get<BuildingVersion>(this.KEYS.VERSIONS)
      .filter(v => v.buildingId === buildingId)
      .sort((a, b) => b.versionNumber - a.versionNumber);
  }

  static createVersion(
    buildingId: string,
    versionName: string,
    description: string,
    changeLog: string,
    createdBy: string
  ): BuildingVersion {
    const versions = this.getVersions(buildingId);
    const newVersionNumber = versions.length > 0 ? versions[0].versionNumber + 1 : 1;
    const allVersions = this.get<BuildingVersion>(this.KEYS.VERSIONS);

    allVersions.forEach(v => {
      if (v.buildingId === buildingId) v.isEffective = false;
    });

    const newVersion: BuildingVersion = {
      id: generateId(),
      buildingId,
      versionNumber: newVersionNumber,
      versionName,
      description,
      isEffective: true,
      createdBy,
      createdAt: now(),
      changeLog,
    };

    allVersions.push(newVersion);
    this.set(this.KEYS.VERSIONS, allVersions);
    this.updateBuilding(buildingId, { currentEffectiveVersionId: newVersion.id });

    return newVersion;
  }

  /**
   * 费用方案管理
   */
  static getCostSchemes(buildingId: string, versionId?: string): CostScheme[] {
    const schemes = this.get<CostScheme>(this.KEYS.COST_SCHEMES).filter(s => s.buildingId === buildingId);
    return versionId ? schemes.filter(s => s.versionId === versionId) : schemes;
  }

  static createCostScheme(scheme: Omit<CostScheme, 'id' | 'createdAt'>): CostScheme {
    const schemes = this.get<CostScheme>(this.KEYS.COST_SCHEMES);
    const newScheme: CostScheme = {
      ...scheme,
      id: generateId(),
      createdAt: now(),
    };
    schemes.push(newScheme);
    this.set(this.KEYS.COST_SCHEMES, schemes);
    return newScheme;
  }

  /**
   * 公示意见管理
   */
  static getComments(buildingId: string, versionId?: string): PublicityComment[] {
    const comments = this.get<PublicityComment>(this.KEYS.COMMENTS).filter(c => c.buildingId === buildingId);
    return versionId ? comments.filter(c => c.versionId === versionId) : comments;
  }

  static createComment(comment: Omit<PublicityComment, 'id' | 'commentDate'>): PublicityComment {
    const comments = this.get<PublicityComment>(this.KEYS.COMMENTS);
    const newComment: PublicityComment = {
      ...comment,
      id: generateId(),
      commentDate: now(),
    };
    comments.push(newComment);
    this.set(this.KEYS.COMMENTS, comments);
    return newComment;
  }

  static respondToComment(commentId: string, response: string, responder: string): PublicityComment | undefined {
    const comments = this.get<PublicityComment>(this.KEYS.COMMENTS);
    const index = comments.findIndex(c => c.id === commentId);
    if (index === -1) return undefined;
    comments[index] = {
      ...comments[index],
      response,
      responder,
      responseDate: now(),
      isResolved: true,
    };
    this.set(this.KEYS.COMMENTS, comments);
    return comments[index];
  }

  /**
   * 进度统计与业务校验
   */
  static getProgressStats(buildingId: string): {
    totalHouseholds: number;
    signedCount: number;
    agreeCount: number;
    disagreeCount: number;
    pendingCount: number;
    agreeRate: number;
    signedRate: number;
    objectionCount: number;
    unresolvedObjectionCount: number;
  } {
    const residents = this.getResidents(buildingId);
    const building = this.getBuilding(buildingId);
    const currentVersionId = building?.currentEffectiveVersionId || '';
    const signRecords = this.getSignRecords(buildingId, currentVersionId);

    const latestSigns = new Map<string, SignRecord>();
    signRecords.forEach(record => {
      const existing = latestSigns.get(record.residentId);
      if (!existing || new Date(record.createdAt) > new Date(existing.createdAt)) {
        latestSigns.set(record.residentId, record);
      }
    });

    let agreeCount = 0;
    let disagreeCount = 0;
    let pendingCount = 0;
    let objectionCount = 0;
    let unresolvedObjectionCount = 0;

    residents.forEach(resident => {
      const sign = latestSigns.get(resident.id);
      if (sign) {
        if (sign.status === 'agree' || (sign.status === 'withdrawn' && sign.isWithdrawnButCounted)) {
          agreeCount++;
        } else if (sign.status === 'disagree') {
          disagreeCount++;
        }
        if (sign.objectionReason) {
          objectionCount++;
          if (sign.objectionStatus === 'pending') {
            unresolvedObjectionCount++;
          }
        }
      } else {
        pendingCount++;
      }
    });

    const totalHouseholds = residents.length;
    const signedCount = totalHouseholds - pendingCount;

    return {
      totalHouseholds,
      signedCount,
      agreeCount,
      disagreeCount,
      pendingCount,
      agreeRate: totalHouseholds > 0 ? (agreeCount / totalHouseholds) * 100 : 0,
      signedRate: totalHouseholds > 0 ? (signedCount / totalHouseholds) * 100 : 0,
      objectionCount,
      unresolvedObjectionCount,
    };
  }

  /**
   * 业务节点准入校验
   */
  static canAdvancePhase(buildingId: string, nextPhase: BusinessPhase): { can: boolean; reason?: string } {
    const stats = this.getProgressStats(buildingId);

    switch (nextPhase) {
      case 'signing':
        return { can: stats.totalHouseholds > 0 };
      case 'publicity':
        if (stats.unresolvedObjectionCount > 0) {
          return { can: false, reason: `还有 ${stats.unresolvedObjectionCount} 个异议待处理` };
        }
        if (stats.agreeRate < 75) {
          return { can: false, reason: `同意率不足 75% (当前: ${stats.agreeRate.toFixed(1)}%)` };
        }
        return { can: true };
      case 'implementation':
        return { can: true };
      case 'completed':
        return { can: true };
      default:
        return { can: true };
    }
  }

  /**
   * 数据导出
   */
  static exportData(buildingId: string): string {
    const building = this.getBuilding(buildingId);
    const residents = this.getResidents(buildingId);
    const signRecords = this.getSignRecords(buildingId);
    const versions = this.getVersions(buildingId);
    const costSchemes = this.getCostSchemes(buildingId);
    const comments = this.getComments(buildingId);
    const stats = this.getProgressStats(buildingId);

    return JSON.stringify({
      building,
      residents,
      signRecords,
      versions,
      costSchemes,
      comments,
      statistics: stats,
      exportDate: now(),
      exportTool: '老楼加装电梯签字管理系统',
    }, null, 2);
  }
}

export default ElevatorService;
