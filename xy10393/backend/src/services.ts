import { dbRun, dbAll, dbGet } from './database';
import { v4 as uuidv4 } from 'uuid';
import { 
  Rider, Checkpoint, EquipmentCheck, EquipmentItem, 
  Checkin, Dropout, Supply, ApprovalComment, FinishRecord 
} from './types';

export class EventService {
  async getCheckpoints(): Promise<Checkpoint[]> {
    const rows = await dbAll('SELECT * FROM checkpoints ORDER BY order_index');
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      orderIndex: row.order_index,
      location: row.location,
      isStart: row.is_start === 1,
      isFinish: row.is_finish === 1
    }));
  }

  async addCheckpoint(cp: Omit<Checkpoint, 'id'>): Promise<Checkpoint> {
    const id = uuidv4();
    await dbRun(`
      INSERT INTO checkpoints (id, name, order_index, location, is_start, is_finish)
      VALUES (?, ?, ?, ?, ?, ?)
    `, id, cp.name, cp.orderIndex, cp.location, cp.isStart ? 1 : 0, cp.isFinish ? 1 : 0);
    return { ...cp, id };
  }

  async getRiders(status?: string): Promise<Rider[]> {
    let sql = 'SELECT * FROM riders';
    const params: any[] = [];
    if (status) {
      sql += ' WHERE status = ?';
      params.push(status);
    }
    sql += ' ORDER BY bib_number';
    const rows = await dbAll(sql, ...params);
    return rows.map(this.mapRider);
  }

  async getRiderByBib(bib: number): Promise<Rider | undefined> {
    const row = await dbGet('SELECT * FROM riders WHERE bib_number = ?', bib);
    return row ? this.mapRider(row) : undefined;
  }

  async getRiderById(id: string): Promise<Rider | undefined> {
    const row = await dbGet('SELECT * FROM riders WHERE id = ?', id);
    return row ? this.mapRider(row) : undefined;
  }

  async registerRider(data: Omit<Rider, 'id' | 'status' | 'registeredAt'>): Promise<Rider> {
    const id = uuidv4();
    const now = new Date().toISOString();
    await dbRun(`
      INSERT INTO riders (id, name, phone, bib_number, team, emergency_contact, emergency_phone, status, registered_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'registered', ?)
    `, id, data.name, data.phone, data.bibNumber, data.team, data.emergencyContact, data.emergencyPhone, now);
    
    return {
      id,
      ...data,
      status: 'registered',
      registeredAt: now
    };
  }

  async recordEquipmentCheck(data: {
    riderId: string;
    items: EquipmentItem[];
    overallResult: 'passed' | 'failed';
    checkerName: string;
    comments?: string;
  }): Promise<EquipmentCheck> {
    const rider = await this.getRiderById(data.riderId);
    if (!rider) throw new Error('骑手不存在');

    const id = uuidv4();
    const now = new Date().toISOString();
    
    await dbRun(`
      INSERT INTO equipment_checks (id, rider_id, checked_at, items, overall_result, checker_name, comments)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, id, data.riderId, now, JSON.stringify(data.items), data.overallResult, data.checkerName, data.comments);

    const newStatus = data.overallResult === 'passed' ? 'equipment_passed' : 'equipment_failed';
    await dbRun('UPDATE riders SET status = ? WHERE id = ?', newStatus, data.riderId);

    return {
      id,
      riderId: data.riderId,
      checkedAt: now,
      items: data.items,
      overallResult: data.overallResult,
      checkerName: data.checkerName,
      comments: data.comments
    };
  }

  async getEquipmentChecks(riderId: string): Promise<EquipmentCheck[]> {
    const rows = await dbAll('SELECT * FROM equipment_checks WHERE rider_id = ? ORDER BY checked_at DESC', riderId);
    return rows.map(row => ({
      id: row.id,
      riderId: row.rider_id,
      checkedAt: row.checked_at,
      items: JSON.parse(row.items),
      overallResult: row.overall_result,
      checkerName: row.checker_name,
      comments: row.comments
    }));
  }

  async recordCheckin(data: {
    riderId: string;
    checkpointId: string;
    checkedBy: string;
  }): Promise<Checkin> {
    const rider = await this.getRiderById(data.riderId);
    if (!rider) throw new Error('骑手不存在');
    
    const checkpoints = await this.getCheckpoints();
    const checkpoint = checkpoints.find(c => c.id === data.checkpointId);
    if (!checkpoint) throw new Error('签到点不存在');

    if (rider.status === 'dropped_out') {
      throw new Error('该骑手已退赛，无法签到');
    }

    if (checkpoint.isStart) {
      if (rider.status !== 'equipment_passed') {
        throw new Error('未通过装备检查，不能出发');
      }
    }

    const existing = await dbGet('SELECT * FROM checkins WHERE rider_id = ? AND checkpoint_id = ?', data.riderId, data.checkpointId);
    if (existing) throw new Error('已在该签到点签到');

    const id = uuidv4();
    const now = new Date().toISOString();

    await dbRun(`
      INSERT INTO checkins (id, rider_id, checkpoint_id, checked_in_at, checked_by)
      VALUES (?, ?, ?, ?, ?)
    `, id, data.riderId, data.checkpointId, now, data.checkedBy);

    if (checkpoint.isStart) {
      await dbRun('UPDATE riders SET status = ? WHERE id = ?', 'in_progress', data.riderId);
    }

    return {
      id,
      riderId: data.riderId,
      checkpointId: data.checkpointId,
      checkedInAt: now,
      checkedBy: data.checkedBy
    };
  }

  async getCheckins(checkpointId?: string, riderId?: string): Promise<Checkin[]> {
    let sql = 'SELECT * FROM checkins WHERE 1=1';
    const params: any[] = [];
    if (checkpointId) {
      sql += ' AND checkpoint_id = ?';
      params.push(checkpointId);
    }
    if (riderId) {
      sql += ' AND rider_id = ?';
      params.push(riderId);
    }
    sql += ' ORDER BY checked_in_at';
    const rows = await dbAll(sql, ...params);
    return rows.map(row => ({
      id: row.id,
      riderId: row.rider_id,
      checkpointId: row.checkpoint_id,
      checkedInAt: row.checked_in_at,
      checkedBy: row.checked_by
    }));
  }

  async recordDropout(data: {
    riderId: string;
    checkpointId?: string;
    reason: string;
    comments?: string;
    recordedBy: string;
  }): Promise<Dropout> {
    const rider = await this.getRiderById(data.riderId);
    if (!rider) throw new Error('骑手不存在');
    if (rider.status === 'dropped_out') throw new Error('该骑手已退赛');
    if (rider.status === 'finished') throw new Error('该骑手已完赛');

    const id = uuidv4();
    const now = new Date().toISOString();

    await dbRun(`
      INSERT INTO dropouts (id, rider_id, checkpoint_id, dropped_at, reason, comments, recorded_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, id, data.riderId, data.checkpointId, now, data.reason, data.comments, data.recordedBy);

    await dbRun('UPDATE riders SET status = ? WHERE id = ?', 'dropped_out', data.riderId);

    return {
      id,
      riderId: data.riderId,
      checkpointId: data.checkpointId,
      droppedAt: now,
      reason: data.reason,
      comments: data.comments,
      recordedBy: data.recordedBy
    };
  }

  async getDropouts(): Promise<Dropout[]> {
    const rows = await dbAll('SELECT * FROM dropouts ORDER BY dropped_at DESC');
    return rows.map(row => ({
      id: row.id,
      riderId: row.rider_id,
      checkpointId: row.checkpoint_id,
      droppedAt: row.dropped_at,
      reason: row.reason,
      comments: row.comments,
      recordedBy: row.recorded_by
    }));
  }

  async recordSupply(data: {
    riderId: string;
    supplyType: 'course' | 'finish';
    checkpointId?: string;
    collectedBy: string;
  }): Promise<Supply> {
    const rider = await this.getRiderById(data.riderId);
    if (!rider) throw new Error('骑手不存在');

    if (data.supplyType === 'finish') {
      if (rider.status === 'dropped_out') {
        throw new Error('退赛骑手不能领取完赛补给');
      }
      if (rider.status !== 'finished') {
        throw new Error('未完赛骑手不能领取完赛补给');
      }
    }

    const existing = await dbGet('SELECT * FROM supplies WHERE rider_id = ? AND supply_type = ?', data.riderId, data.supplyType);
    if (existing) throw new Error('已领取该类补给');

    const id = uuidv4();
    const now = new Date().toISOString();

    await dbRun(`
      INSERT INTO supplies (id, rider_id, supply_type, checkpoint_id, collected_at, collected_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `, id, data.riderId, data.supplyType, data.checkpointId, now, data.collectedBy);

    return {
      id,
      riderId: data.riderId,
      supplyType: data.supplyType,
      checkpointId: data.checkpointId,
      collectedAt: now,
      collectedBy: data.collectedBy
    };
  }

  async getSupplies(riderId?: string): Promise<Supply[]> {
    let sql = 'SELECT * FROM supplies WHERE 1=1';
    const params: any[] = [];
    if (riderId) {
      sql += ' AND rider_id = ?';
      params.push(riderId);
    }
    sql += ' ORDER BY collected_at DESC';
    const rows = await dbAll(sql, ...params);
    return rows.map(row => ({
      id: row.id,
      riderId: row.rider_id,
      supplyType: row.supply_type,
      checkpointId: row.checkpoint_id,
      collectedAt: row.collected_at,
      collectedBy: row.collected_by
    }));
  }

  async recordFinish(data: {
    riderId: string;
    recordedBy: string;
  }): Promise<FinishRecord> {
    const rider = await this.getRiderById(data.riderId);
    if (!rider) throw new Error('骑手不存在');
    if (rider.status === 'finished') throw new Error('该骑手已完赛');
    if (rider.status === 'dropped_out') throw new Error('退赛骑手不能完赛');

    const checkpoints = await this.getCheckpoints();
    const finishCp = checkpoints.find(c => c.isFinish);
    if (!finishCp) throw new Error('未设置终点');

    const checkins = await this.getCheckins(undefined, data.riderId);
    const requiredCheckpoints = checkpoints.filter(c => !c.isStart).map(c => c.id);
    const missing = requiredCheckpoints.filter(cpId => !checkins.some(ci => ci.checkpointId === cpId));
    
    if (missing.length > 0) {
      const missingNames = checkpoints.filter(c => missing.includes(c.id)).map(c => c.name);
      throw new Error(`漏签签到点: ${missingNames.join(', ')}，不能直接完赛`);
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    const startCheckin = checkins.find(ci => {
      const cp = checkpoints.find(c => c.id === ci.checkpointId);
      return cp?.isStart;
    });

    let totalTime: number | undefined;
    if (startCheckin) {
      totalTime = (new Date(now).getTime() - new Date(startCheckin.checkedInAt).getTime()) / 1000;
    }

    await dbRun(`
      INSERT INTO finish_records (id, rider_id, finished_at, total_time, recorded_by)
      VALUES (?, ?, ?, ?, ?)
    `, id, data.riderId, now, totalTime, data.recordedBy);

    await dbRun('UPDATE riders SET status = ? WHERE id = ?', 'finished', data.riderId);

    return {
      id,
      riderId: data.riderId,
      finishedAt: now,
      totalTime,
      recordedBy: data.recordedBy
    };
  }

  async getFinishRecords(): Promise<FinishRecord[]> {
    const rows = await dbAll('SELECT * FROM finish_records ORDER BY finished_at');
    return rows.map(row => ({
      id: row.id,
      riderId: row.rider_id,
      finishedAt: row.finished_at,
      totalTime: row.total_time,
      recordedBy: row.recorded_by
    }));
  }

  async addApprovalComment(data: Omit<ApprovalComment, 'id' | 'madeAt'>): Promise<ApprovalComment> {
    const id = uuidv4();
    const now = new Date().toISOString();
    await dbRun(`
      INSERT INTO approval_comments (id, related_type, related_id, action, decision, comments, made_by, made_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, id, data.relatedType, data.relatedId, data.action, data.decision, data.comments, data.madeBy, now);
    return { ...data, id, madeAt: now };
  }

  async getApprovalComments(relatedType?: string, relatedId?: string): Promise<ApprovalComment[]> {
    let sql = 'SELECT * FROM approval_comments WHERE 1=1';
    const params: any[] = [];
    if (relatedType) {
      sql += ' AND related_type = ?';
      params.push(relatedType);
    }
    if (relatedId) {
      sql += ' AND related_id = ?';
      params.push(relatedId);
    }
    sql += ' ORDER BY made_at DESC';
    const rows = await dbAll(sql, ...params);
    return rows.map(row => ({
      id: row.id,
      relatedType: row.related_type,
      relatedId: row.related_id,
      action: row.action,
      decision: row.decision,
      comments: row.comments,
      madeBy: row.made_by,
      madeAt: row.made_at
    }));
  }

  async getRiderDetails(riderId: string) {
    const rider = await this.getRiderById(riderId);
    if (!rider) return null;
    
    return {
      rider,
      equipmentChecks: await this.getEquipmentChecks(riderId),
      checkins: await this.getCheckins(undefined, riderId),
      supplies: await this.getSupplies(riderId),
      dropouts: (await this.getDropouts()).filter(d => d.riderId === riderId),
      finishRecords: (await this.getFinishRecords()).filter(f => f.riderId === riderId)
    };
  }

  async getDashboardStats() {
    const checkpoints = await this.getCheckpoints();
    const riders = await this.getRiders();
    const checkins = await this.getCheckins();
    const dropouts = await this.getDropouts();
    const finishes = await this.getFinishRecords();
    const supplies = await this.getSupplies();

    const statusCounts: Record<string, number> = {};
    riders.forEach(r => {
      statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
    });

    const checkpointStats = [];
    for (const cp of checkpoints) {
      const cpCheckins = checkins.filter(c => c.checkpointId === cp.id);
      checkpointStats.push({
        ...cp,
        totalChecked: cpCheckins.length,
        checkedRiders: cpCheckins.map(c => riders.find(r => r.id === c.riderId)).filter(Boolean)
      });
    }

    const missingCheckins = riders.filter(r => {
      if (r.status === 'registered' || r.status === 'equipment_passed') return false;
      if (r.status === 'finished' || r.status === 'dropped_out') return false;
      const riderCheckins = checkins.filter(c => c.riderId === r.id).map(c => c.checkpointId);
      const required = checkpoints.filter(c => !c.isStart).map(c => c.id);
      return required.some(cpId => !riderCheckins.includes(cpId));
    });

    return {
      totalRiders: riders.length,
      statusCounts,
      checkpointStats,
      dropouts,
      finishCount: finishes.length,
      supplyStats: {
        course: supplies.filter(s => s.supplyType === 'course').length,
        finish: supplies.filter(s => s.supplyType === 'finish').length
      },
      missingCheckins,
      dropoutsCount: dropouts.length
    };
  }

  async exportReport() {
    const riders = await this.getRiders();
    const checkpoints = await this.getCheckpoints();
    const allCheckins = await this.getCheckins();
    const allDropouts = await this.getDropouts();
    const allEquipmentChecks = await dbAll('SELECT * FROM equipment_checks');
    const allSupplies = await this.getSupplies();
    const allApprovalComments = await this.getApprovalComments();
    const allFinishRecords = await this.getFinishRecords();

    const report: any = {
      generatedAt: new Date().toISOString(),
      summary: {
        totalRiders: riders.length,
        statusCounts: {},
        checkpointStats: checkpoints.map(cp => ({
          name: cp.name,
          totalChecked: allCheckins.filter(c => c.checkpointId === cp.id).length
        })),
        dropoutsCount: allDropouts.length,
        finishCount: allFinishRecords.length
      },
      riders: []
    };

    for (const rider of riders) {
      const riderCheckins = allCheckins.filter(c => c.riderId === rider.id);
      const riderCheckpoints = checkpoints.filter(cp => riderCheckins.some(ci => ci.checkpointId === cp.id));
      const missingCheckpoints = checkpoints.filter(cp => !riderCheckins.some(ci => ci.checkpointId === cp.id));
      const equipmentCheck = allEquipmentChecks.find((e: any) => e.rider_id === rider.id);
      const dropout = allDropouts.find(d => d.riderId === rider.id);
      const finish = allFinishRecords.find(f => f.riderId === rider.id);
      const supplies = allSupplies.filter(s => s.riderId === rider.id);
      const approvals = allApprovalComments.filter(a => a.relatedId === rider.id);

      report.riders.push({
        bibNumber: rider.bibNumber,
        name: rider.name,
        phone: rider.phone,
        team: rider.team,
        status: rider.status,
        equipmentCheck: equipmentCheck ? {
          result: equipmentCheck.overall_result,
          items: JSON.parse(equipmentCheck.items),
          comments: equipmentCheck.comments,
          checkedBy: equipmentCheck.checker_name,
          checkedAt: equipmentCheck.checked_at
        } : null,
        checkedInPoints: riderCheckpoints.map(cp => ({
          name: cp.name,
          time: riderCheckins.find(ci => ci.checkpointId === cp.id)?.checkedInAt
        })),
        missingPoints: missingCheckpoints.map(cp => cp.name),
        dropout: dropout ? {
          reason: dropout.reason,
          comments: dropout.comments,
          at: dropout.droppedAt
        } : null,
        finish: finish ? {
          at: finish.finishedAt,
          totalTimeSeconds: finish.totalTime
        } : null,
        supplies: supplies.map(s => ({
          type: s.supplyType,
          at: s.collectedAt
        })),
        approvalHistory: approvals.map(a => ({
          action: a.action,
          decision: a.decision,
          comments: a.comments,
          madeBy: a.madeBy,
          at: a.madeAt
        }))
      });
    }

    riders.forEach(r => {
      report.summary.statusCounts[r.status] = 
        (report.summary.statusCounts[r.status] || 0) + 1;
    });

    return report;
  }

  private mapRider(row: any): Rider {
    return {
      id: row.id,
      name: row.name,
      phone: row.phone,
      bibNumber: row.bib_number,
      team: row.team,
      emergencyContact: row.emergency_contact,
      emergencyPhone: row.emergency_phone,
      status: row.status,
      registeredAt: row.registered_at
    };
  }
}

export default new EventService();
