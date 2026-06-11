import { CollisionRepo } from '../repositories/CollisionRepo.js';
import { MaterialRepo } from '../repositories/MaterialRepo.js';
import { VersionRepo } from '../repositories/VersionRepo.js';
import { AuditRepo } from '../repositories/AuditRepo.js';
import type {
  Collision,
  CollisionQuery,
  CreateMaterialPayload,
  ExportRow,
  PatchCollisionPayload,
  VersionSnapshot,
} from '../../shared/types.js';
import { changeTypeLabel, diffFields, md5, nowISO, statusLabel, uid } from '../utils.js';

class CollisionService {
  private collisionRepo: CollisionRepo;
  private materialRepo: MaterialRepo;
  private versionRepo: VersionRepo;
  private auditRepo: AuditRepo;

  constructor() {
    this.collisionRepo = new CollisionRepo();
    this.materialRepo = new MaterialRepo();
    this.versionRepo = new VersionRepo();
    this.auditRepo = new AuditRepo();
  }

  list(q: CollisionQuery = {}): Collision[] {
    return this.collisionRepo.list(q);
  }
  getById(id: string): Collision | null {
    return this.collisionRepo.getById(id);
  }
  getMaterials(id: string) {
    return this.materialRepo.listByCollision(id);
  }
  getVersions(id: string) {
    return this.versionRepo.listByCollision(id);
  }
  getDiff(id: string, v1: number, v2: number) {
    const a = this.versionRepo.getByVersion(id, v1);
    const b = this.versionRepo.getByVersion(id, v2);
    if (!a || !b) return null;
    return {
      v1: a,
      v2: b,
      diffs: diffFields(a.snapshot as any, b.snapshot as any, [
        'remark',
        'conclusion',
        'status',
        'isAbnormal',
        'abnormalReason',
        'version',
      ]),
    };
  }
  getAudit(q: any) {
    return this.auditRepo.list(q);
  }

  patch(id: string, payload: PatchCollisionPayload): Collision | null {
    const before = this.collisionRepo.getById(id);
    if (!before) return null;
    const nextVersion = before.version + 1;

    this.collisionRepo.patch(id, {
      remark: payload.remark,
      status: payload.status,
      conclusion: payload.conclusion,
      isAbnormal: payload.isAbnormal,
      abnormalReason:
        Object.prototype.hasOwnProperty.call(payload, 'abnormalReason')
          ? payload.abnormalReason ?? null
          : undefined,
      lastModifiedBy: payload.changedBy,
      lastModifiedByName: payload.changedByName,
      lastModifiedAt: nowISO(),
      version: nextVersion,
    });
    const after = this.collisionRepo.getById(id)!;

    // 计算字段变更（只计算实际传入的字段）
    const watching: Array<keyof PatchCollisionPayload> = [
      'remark',
      'status',
      'conclusion',
      'isAbnormal',
      'abnormalReason',
    ];
    const onlyPatch: Record<string, any> = {};
    const onlyBefore: Record<string, any> = {};
    for (const k of watching) {
      if (Object.prototype.hasOwnProperty.call(payload, k)) {
        onlyPatch[k] = (payload as any)[k];
        onlyBefore[k] = (before as any)[k];
      }
    }
    const diffs = diffFields(onlyBefore, onlyPatch, Object.keys(onlyPatch));
    // 确定 changeType（按优先级：异常>结论>状态>备注）
    let changeType: VersionSnapshot['changeType'] = 'remark';
    if ('isAbnormal' in onlyPatch || 'abnormalReason' in onlyPatch) changeType = 'abnormal';
    else if ('conclusion' in onlyPatch) changeType = 'conclusion';
    else if ('status' in onlyPatch) changeType = 'status';

    if (diffs.length > 0) {
      const meta = changeTypeLabel(changeType);
      const snap: VersionSnapshot = {
        id: uid('VS-'),
        collisionId: id,
        version: nextVersion,
        changedBy: payload.changedBy,
        changedByName: payload.changedByName,
        changedAt: nowISO(),
        changeType,
        changeReason: payload.changeReason,
        fieldDiffs: diffs,
        snapshot: { ...after },
      };
      this.versionRepo.insert(snap);
      this.auditRepo.insert({
        id: uid('AL-'),
        collisionId: id,
        action: meta.label,
        actionBadgeColor: meta.color,
        operator: payload.changedBy,
        operatorName: payload.changedByName,
        timestamp: snap.changedAt,
        reason: payload.changeReason,
        detail: diffs
          .map((d) => `${d.field}: ${JSON.stringify(d.oldValue)} → ${JSON.stringify(d.newValue)}`)
          .join('; '),
      });
    }
    return after;
  }

  addMaterial(p: CreateMaterialPayload) {
    const before = this.collisionRepo.getById(p.collisionId);
    if (!before) return null;
    const version = this.materialRepo.nextVersion(p.collisionId, p.type);
    const previousId = this.materialRepo.getPreviousId(p.collisionId, p.type);
    const hash = md5(p.content);
    const uploadedAt = nowISO();
    this.materialRepo.insert({
      id: uid('MT-'),
      collisionId: p.collisionId,
      type: p.type,
      content: p.content,
      md5: hash,
      uploader: p.uploader,
      uploaderName: p.uploaderName,
      uploadedAt,
      version,
      previousId,
    });
    const nextVersion = before.version + 1;
    // 只更新版本时间戳和lastModifiedBy
    this.collisionRepo.patch(p.collisionId, {
      lastModifiedBy: p.uploader,
      lastModifiedByName: p.uploaderName,
      lastModifiedAt: uploadedAt,
      version: nextVersion,
    });
    const after = this.collisionRepo.getById(p.collisionId)!;
    const isModify = version > 1;
    const changeType: VersionSnapshot['changeType'] = isModify ? 'material_modify' : 'material_add';
    const meta = changeTypeLabel(changeType);
    const diffs = isModify
      ? [
          {
            field: `${p.type} 材料 v${version - 1}→v${version}`,
            oldValue: previousId ? 'MD5 ' + (this.materialRepo.getPreviousId(p.collisionId, p.type) ?? '') : null,
            newValue: 'MD5 ' + hash,
          },
        ]
      : [{ field: `${p.type} 材料新增`, oldValue: null, newValue: `v${version}` }];
    this.versionRepo.insert({
      id: uid('VS-'),
      collisionId: p.collisionId,
      version: nextVersion,
      changedBy: p.uploader,
      changedByName: p.uploaderName,
      changedAt: uploadedAt,
      changeType,
      changeReason: p.changeReason,
      fieldDiffs: diffs,
      snapshot: { ...after },
    });
    this.auditRepo.insert({
      id: uid('AL-'),
      collisionId: p.collisionId,
      action: meta.label,
      actionBadgeColor: meta.color,
      operator: p.uploader,
      operatorName: p.uploaderName,
      timestamp: uploadedAt,
      reason: p.changeReason,
      detail: `${p.type} v${version}${isModify ? '（改口径）' : ''}：${p.content.slice(0, 80)}${p.content.length > 80 ? '…' : ''}`,
    });
    return this.materialRepo.listByCollision(p.collisionId);
  }

  exportPreview(): ExportRow[] {
    const list = this.collisionRepo.list();
    return list.map((c) => {
      const bimMat = this.materialRepo.getLatestByType(c.id, 'bim_note');
      return {
        collisionId: c.id,
        coordinate: `(${c.coordinateX.toFixed(0)}, ${c.coordinateY.toFixed(0)}, ${c.coordinateZ.toFixed(0)})`,
        floor: c.floor,
        discipline: c.discipline,
        status: statusLabel(c.status),
        bimNoteOriginal: bimMat?.content ?? '',
        remark: c.remark,
        conclusion: c.conclusion,
        isAbnormal: c.isAbnormal,
        abnormalReason: c.abnormalReason,
        lastModifiedAt: c.lastModifiedAt,
        lastModifiedBy: c.lastModifiedBy,
        lastModifiedByName: c.lastModifiedByName ?? c.lastModifiedBy,
      };
    });
  }

  exportCSV(): { filename: string; content: string } {
    const rows = this.exportPreview();
    const header = [
      '碰撞点编号',
      '坐标',
      '楼层',
      '专业',
      '状态',
      'BIM备注原文',
      '最新备注',
      '处理结论',
      '是否异常',
      '异常原因',
      '最后修改人工号',
      '最后修改人姓名',
      '最后修改时间',
    ];
    const esc = (v: any) => {
      if (v === null || v === undefined) return '';
      const s = String(v).replace(/"/g, '""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    };
    const lines = [header.join(',')];
    for (const r of rows) {
      lines.push(
        [
          r.collisionId,
          r.coordinate,
          r.floor,
          r.discipline,
          r.status,
          r.bimNoteOriginal,
          r.remark,
          r.conclusion,
          r.isAbnormal ? '是' : '否',
          r.abnormalReason ?? '',
          r.lastModifiedBy,
          r.lastModifiedByName,
          r.lastModifiedAt,
        ]
          .map(esc)
          .join(','),
      );
    }
    const now = new Date();
    const pad2 = (n: number) => String(n).padStart(2, '0');
    const ts = `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}_${pad2(
      now.getHours(),
    )}${pad2(now.getMinutes())}`;
    const version = 'v' + (rows[0] ? String(rows.length) : '0');
    return {
      filename: `施工变更碰撞预审_${version}_${ts}.csv`,
      content: '\ufeff' + lines.join('\n'),
    };
  }
}

export const collisionService = new CollisionService();
