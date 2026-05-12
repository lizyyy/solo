import type { Building, Resident, SignRecord, CostScheme, PublicityComment, BuildingVersion, ProgressStats, SignStatus, BusinessPhase } from './types';

const generateId = () => Math.random().toString(36).substr(2, 9);
const now = () => new Date().toISOString();

export class ElevatorSignStore {
  private static BUILDINGS_KEY = 'elevator_buildings';
  private static RESIDENTS_KEY = 'elevator_residents';
  private static SIGN_RECORDS_KEY = 'elevator_sign_records';
  private static COST_SCHEMES_KEY = 'elevator_cost_schemes';
  private static COMMENTS_KEY = 'elevator_comments';
  private static VERSIONS_KEY = 'elevator_versions';

  static getAllBuildings(): Building[] {
    const data = localStorage.getItem(this.BUILDINGS_KEY);
    return data ? JSON.parse(data) : [];
  }

  static getBuilding(id: string): Building | undefined {
    return this.getAllBuildings().find(b => b.id === id);
  }

  static saveBuilding(building: Omit<Building, 'id' | 'createdAt' | 'updatedAt'>): Building {
    const buildings = this.getAllBuildings();
    const newBuilding: Building = {
      ...building,
      id: generateId(),
      createdAt: now(),
      updatedAt: now(),
    };
    buildings.push(newBuilding);
    localStorage.setItem(this.BUILDINGS_KEY, JSON.stringify(buildings));
    return newBuilding;
  }

  static updateBuilding(id: string, updates: Partial<Building>): Building | undefined {
    const buildings = this.getAllBuildings();
    const index = buildings.findIndex(b => b.id === id);
    if (index === -1) return undefined;
    buildings[index] = { ...buildings[index], ...updates, updatedAt: now() };
    localStorage.setItem(this.BUILDINGS_KEY, JSON.stringify(buildings));
    return buildings[index];
  }

  static getResidents(buildingId: string): Resident[] {
    const data = localStorage.getItem(this.RESIDENTS_KEY);
    const all: Resident[] = data ? JSON.parse(data) : [];
    return all.filter(r => r.buildingId === buildingId);
  }

  static saveResident(resident: Omit<Resident, 'id' | 'createdAt' | 'updatedAt'>): Resident {
    const data = localStorage.getItem(this.RESIDENTS_KEY);
    const all: Resident[] = data ? JSON.parse(data) : [];
    const newResident: Resident = {
      ...resident,
      id: generateId(),
      createdAt: now(),
      updatedAt: now(),
    };
    all.push(newResident);
    localStorage.setItem(this.RESIDENTS_KEY, JSON.stringify(all));
    return newResident;
  }

  static updateResident(id: string, updates: Partial<Resident>): Resident | undefined {
    const data = localStorage.getItem(this.RESIDENTS_KEY);
    const all: Resident[] = data ? JSON.parse(data) : [];
    const index = all.findIndex(r => r.id === id);
    if (index === -1) return undefined;
    all[index] = { ...all[index], ...updates, updatedAt: now() };
    localStorage.setItem(this.RESIDENTS_KEY, JSON.stringify(all));
    return all[index];
  }

  static getSignRecords(buildingId: string, versionId?: string): SignRecord[] {
    const data = localStorage.getItem(this.SIGN_RECORDS_KEY);
    const all: SignRecord[] = data ? JSON.parse(data) : [];
    return all.filter(r => r.buildingId === buildingId && (!versionId || r.versionId === versionId));
  }

  static getResidentLatestSign(residentId: string, buildingId: string): SignRecord | undefined {
    const records = this.getSignRecords(buildingId).filter(r => r.residentId === residentId);
    return records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  }

  static saveSignRecord(record: Omit<SignRecord, 'id' | 'createdAt' | 'updatedAt'>): SignRecord | null {
    const existing = this.getResidentLatestSign(record.residentId, record.buildingId);
    const isDuplicate = existing && 
      existing.status === record.status && 
      existing.versionId === record.versionId;
    
    if (isDuplicate && !record.isWithdrawnButCounted) {
      return null;
    }

    const data = localStorage.getItem(this.SIGN_RECORDS_KEY);
    const all: SignRecord[] = data ? JSON.parse(data) : [];
    
    const newRecord: SignRecord = {
      ...record,
      id: generateId(),
      isDuplicate: isDuplicate || false,
      createdAt: now(),
      updatedAt: now(),
    };
    
    all.push(newRecord);
    localStorage.setItem(this.SIGN_RECORDS_KEY, JSON.stringify(all));
    return newRecord;
  }

  static withdrawSign(recordId: string, handler: string, stillCounted: boolean = false): SignRecord | undefined {
    const data = localStorage.getItem(this.SIGN_RECORDS_KEY);
    const all: SignRecord[] = data ? JSON.parse(data) : [];
    const index = all.findIndex(r => r.id === recordId);
    if (index === -1) return undefined;
    
    const record = all[index];
    const withdrawnRecord: SignRecord = {
      ...record,
      id: generateId(),
      status: 'withdrawn',
      isWithdrawnButCounted: stillCounted,
      handler,
      createdAt: now(),
      updatedAt: now(),
    };
    all.push(withdrawnRecord);
    localStorage.setItem(this.SIGN_RECORDS_KEY, JSON.stringify(all));
    return withdrawnRecord;
  }

  static updateObjectionStatus(
    recordId: string,
    status: 'processing' | 'resolved' | 'rejected',
    handler: string
  ): SignRecord | undefined {
    const data = localStorage.getItem(this.SIGN_RECORDS_KEY);
    const all: SignRecord[] = data ? JSON.parse(data) : [];
    const record = all.find(r => r.id === recordId);
    if (!record) return undefined;

    const updatedRecord: SignRecord = {
      ...record,
      objectionStatus: status,
      objectionHandler: handler,
      objectionHandleDate: now(),
      updatedAt: now(),
    };
    
    const index = all.findIndex(r => r.id === recordId);
    all[index] = updatedRecord;
    localStorage.setItem(this.SIGN_RECORDS_KEY, JSON.stringify(all));
    return updatedRecord;
  }

  static getVersions(buildingId: string): BuildingVersion[] {
    const data = localStorage.getItem(this.VERSIONS_KEY);
    const all: BuildingVersion[] = data ? JSON.parse(data) : [];
    return all.filter(v => v.buildingId === buildingId).sort((a, b) => b.versionNumber - a.versionNumber);
  }

  static createVersion(buildingId: string, versionName: string, description: string, changeLog: string, createdBy: string): BuildingVersion {
    const versions = this.getVersions(buildingId);
    const newVersionNumber = versions.length > 0 ? versions[0].versionNumber + 1 : 1;
    
    const data = localStorage.getItem(this.VERSIONS_KEY);
    const all: BuildingVersion[] = data ? JSON.parse(data) : [];
    
    all.forEach(v => {
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
    
    all.push(newVersion);
    localStorage.setItem(this.VERSIONS_KEY, JSON.stringify(all));
    
    this.updateBuilding(buildingId, { currentEffectiveVersionId: newVersion.id });
    
    return newVersion;
  }

  static getCostSchemes(buildingId: string, versionId?: string): CostScheme[] {
    const data = localStorage.getItem(this.COST_SCHEMES_KEY);
    const all: CostScheme[] = data ? JSON.parse(data) : [];
    return all.filter(c => c.buildingId === buildingId && (!versionId || c.versionId === versionId));
  }

  static saveCostScheme(scheme: Omit<CostScheme, 'id' | 'createdAt'>): CostScheme {
    const data = localStorage.getItem(this.COST_SCHEMES_KEY);
    const all: CostScheme[] = data ? JSON.parse(data) : [];
    const newScheme: CostScheme = {
      ...scheme,
      id: generateId(),
      createdAt: now(),
    };
    all.push(newScheme);
    localStorage.setItem(this.COST_SCHEMES_KEY, JSON.stringify(all));
    return newScheme;
  }

  static getComments(buildingId: string, versionId?: string): PublicityComment[] {
    const data = localStorage.getItem(this.COMMENTS_KEY);
    const all: PublicityComment[] = data ? JSON.parse(data) : [];
    return all.filter(c => c.buildingId === buildingId && (!versionId || c.versionId === versionId));
  }

  static saveComment(comment: Omit<PublicityComment, 'id' | 'commentDate'>): PublicityComment {
    const data = localStorage.getItem(this.COMMENTS_KEY);
    const all: PublicityComment[] = data ? JSON.parse(data) : [];
    const newComment: PublicityComment = {
      ...comment,
      id: generateId(),
      commentDate: now(),
    };
    all.push(newComment);
    localStorage.setItem(this.COMMENTS_KEY, JSON.stringify(all));
    return newComment;
  }

  static respondToComment(commentId: string, response: string, responder: string): PublicityComment | undefined {
    const data = localStorage.getItem(this.COMMENTS_KEY);
    const all: PublicityComment[] = data ? JSON.parse(data) : [];
    const index = all.findIndex(c => c.id === commentId);
    if (index === -1) return undefined;
    all[index] = {
      ...all[index],
      response,
      responder,
      responseDate: now(),
      isResolved: true,
    };
    localStorage.setItem(this.COMMENTS_KEY, JSON.stringify(all));
    return all[index];
  }

  static getProgressStats(buildingId: string): ProgressStats {
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

  static canAdvancePhase(buildingId: string, nextPhase: BusinessPhase): { can: boolean; reason?: string } {
    const stats = this.getProgressStats(buildingId);
    
    switch (nextPhase) {
      case 'signing':
        return { can: stats.totalHouseholds > 0 };
      case 'publicity':
        if (stats.unresolvedObjectionCount > 0) {
          return { can: false, reason: `还有 ${stats.unresolvedObjectionCount} 个异议未处理` };
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
    }, null, 2);
  }

  static initializeDemoData(): void {
    if (this.getAllBuildings().length > 0) return;

    const building = this.saveBuilding({
      name: '阳光花园 3 号楼',
      address: '北京市朝阳区阳光花园小区',
      totalHouseholds: 24,
      totalFloors: 6,
      units: ['1单元', '2单元'],
      currentPhase: 'signing',
      currentEffectiveVersionId: '',
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
      this.saveResident({
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

    this.saveCostScheme({
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
        this.saveSignRecord({
          buildingId: building.id,
          residentId: resident.id,
          versionId: version.id,
          status,
          signDate: now(),
          objectionReason: status === 'disagree' ? '担心噪音影响' : undefined,
          objectionStatus: status === 'disagree' ? 'pending' : undefined,
          isDuplicate: false,
          isWithdrawnButCounted: false,
          handler: '社区工作人员',
        });
      }
    });
  }
}
