import {
  _now,
  _new_id,
  viewpointFingerprint,
  collisionDedupKey,
  defaultCameraUp,
  ConclusionDisplay,
  ConclusionEnum,
  RecordStatusEnum,
  OperationTypeEnum,
  type ViewPoint,
  type CollisionPoint,
  type MaterialReviewItem,
  type HistoryVersion,
  type AuditLog,
  type PendingConfirmItem,
  type SchemeComparisonRecord,
  type Conclusion,
  type OperationType,
  type Remark,
  type Severity,
} from '../shared/types.js';

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

function conclusionDisplay(c?: Conclusion): string | undefined {
  return c ? ConclusionDisplay[c] : undefined;
}

// =============================================================================
// 模块 1：碰撞点去重检测 + 挂起 + 结论牵动分析
// =============================================================================

export class CollisionDedupService {
  static scanDuplicates(
    materials: MaterialReviewItem[],
  ): Record<string, CollisionPoint[]> {
    const buckets: Record<string, CollisionPoint[]> = {};
    for (const mat of materials) {
      for (const cp of mat.collision_points) {
        const key = collisionDedupKey(cp);
        if (!buckets[key]) buckets[key] = [];
        buckets[key].push(cp);
      }
    }
    const result: Record<string, CollisionPoint[]> = {};
    for (const [k, v] of Object.entries(buckets)) {
      if (v.length > 1) result[k] = v;
    }
    return result;
  }

  static analyzeImpact(
    record: SchemeComparisonRecord,
    dupIds: string[],
  ): { impactAnalysis: string; affected: Conclusion[] } {
    const affectedSet = new Set<Conclusion>();
    const reasons: string[] = [];
    let hasHigh = false;
    let hasMedium = false;

    for (const dupId of dupIds) {
      for (const mat of record.materials) {
        for (const cp of mat.collision_points) {
          if (cp.collision_id === dupId) {
            if (cp.severity === 'high') {
              hasHigh = true;
              reasons.push(
                `高危碰撞点 [${cp.description}] 重复，直接影响材料用量核算`,
              );
            } else if (cp.severity === 'medium') {
              hasMedium = true;
              reasons.push(
                `中危碰撞点 [${cp.description}] 重复，可能影响方案承载力校核`,
              );
            } else {
              reasons.push(
                `低危碰撞点 [${cp.description}] 重复，需确认是否为同一处`,
              );
            }
          }
        }
      }
    }

    if (record.conclusion) {
      affectedSet.add(record.conclusion);
      if (hasHigh) {
        affectedSet.add('needs_inspection');
        affectedSet.add('scheme_a');
        affectedSet.add('scheme_c');
      } else if (hasMedium) {
        affectedSet.add('scheme_a');
      }
      reasons.push(
        `当前结论为「${conclusionDisplay(record.conclusion)}」，待确认后可能发生改判`,
      );
    }

    return {
      impactAnalysis: reasons.length
        ? reasons.join('；')
        : '暂无明确牵动影响，需人工复核',
      affected: Array.from(affectedSet),
    };
  }
}

export class SuspensionService {
  static suspendForDuplicates(
    record: SchemeComparisonRecord,
    operator: string,
  ): PendingConfirmItem[] {
    const duplicates = CollisionDedupService.scanDuplicates(record.materials);
    const created: PendingConfirmItem[] = [];

    for (const [dedupKey, cpList] of Object.entries(duplicates)) {
      const dupIds = cpList.map((c) => c.collision_id);
      const dupKeySorted = [...dupIds].sort().join('|');
      const alreadyPending = record.pending_queue.some(
        (p) =>
          !p.resolved_at &&
          [...p.duplicate_collision_ids].sort().join('|') === dupKeySorted,
      );
      if (alreadyPending) continue;
      const matIdSet = new Set<string>();
      for (const m of record.materials) {
        for (const c of m.collision_points) {
          if (dupIds.includes(c.collision_id)) {
            matIdSet.add(m.item_id);
          }
        }
      }
      const { impactAnalysis, affected } = CollisionDedupService.analyzeImpact(
        record,
        dupIds,
      );

      const pending: PendingConfirmItem = {
        pending_id: _new_id('PND'),
        record_id: record.record_id,
        material_item_id: Array.from(matIdSet).join(','),
        duplicate_collision_ids: dupIds,
        impact_analysis: impactAnalysis,
        affected_conclusions: affected,
        suspended_at: _now(),
        suspended_by: operator,
      };
      record.pending_queue.push(pending);
      created.push(pending);
    }

    if (created.length > 0) {
      record.status = RecordStatusEnum.PENDING_CONFIRM;
      AuditService.log(
        record,
        operator,
        OperationTypeEnum.SUSPEND,
        `检测到 ${created.length} 组重复碰撞点，记录挂起并移入待确认`,
        {
          status: {
            old: RecordStatusEnum.ACTIVE,
            new: RecordStatusEnum.PENDING_CONFIRM,
          },
          pending_items: { count: created.length },
        },
      );
    }

    return created;
  }

  static resolvePending(
    record: SchemeComparisonRecord,
    pendingId: string,
    operator: string,
    resolution: string,
    keepCollisionId?: string,
  ): boolean {
    for (const p of record.pending_queue) {
      if (p.pending_id === pendingId && !p.resolved_at) {
        p.resolved_at = _now();
        p.resolved_by = operator;
        p.resolution = resolution;

        if (keepCollisionId) {
          for (const mat of record.materials) {
            mat.collision_points = mat.collision_points.filter(
              (c) =>
                c.collision_id === keepCollisionId ||
                !p.duplicate_collision_ids.includes(c.collision_id),
            );
          }
        }

        const unresolved = record.pending_queue.some((x) => !x.resolved_at);
        if (!unresolved) {
          record.status = RecordStatusEnum.CONFIRMED;
        }

        AuditService.log(
          record,
          operator,
          OperationTypeEnum.CONFIRM,
          `待确认项 ${pendingId} 已解决：${resolution}`,
          {
            pending_id: { value: pendingId },
            resolution: { value: resolution },
          },
        );
        return true;
      }
    }
    return false;
  }
}

// =============================================================================
// 模块 2：历史版本链
// =============================================================================

export class HistoryService {
  private static _snapshotMaterials(
    record: SchemeComparisonRecord,
  ): Record<string, unknown> {
    return {
      materials: deepClone(record.materials),
      conclusion: record.conclusion ?? null,
      confidence: record.confidence,
      status: record.status,
    };
  }

  static createVersion(
    record: SchemeComparisonRecord,
    operator: string,
    params: {
      reviseReason?: string;
      oldConclusion?: Conclusion;
      newConclusion?: Conclusion;
      newRemarks?: Remark[];
    } = {},
  ): HistoryVersion {
    const parent =
      record.history_chain.length > 0
        ? record.history_chain[record.history_chain.length - 1]
        : undefined;
    const version: HistoryVersion = {
      version_id: _new_id('HIS'),
      version_no: record.current_version,
      parent_id: parent?.version_id,
      snapshot_material: HistoryService._snapshotMaterials(record),
      new_remarks: params.newRemarks ?? [],
      old_conclusion: params.oldConclusion,
      new_conclusion: params.newConclusion,
      revise_reason: params.reviseReason ?? '',
      operator,
      operated_at: _now(),
      affected_conclusion_ids: [],
    };
    record.history_chain.push(version);
    record.current_version += 1;
    record.updated_at = _now();
    return version;
  }

  static getVersion(
    record: SchemeComparisonRecord,
    versionNo: number,
  ): HistoryVersion | undefined {
    return record.history_chain.find((v) => v.version_no === versionNo);
  }

  static traceRevisionsByOperator(
    record: SchemeComparisonRecord,
    operator: string,
  ): HistoryVersion[] {
    return record.history_chain.filter(
      (v) =>
        v.operator === operator && v.old_conclusion !== v.new_conclusion,
    );
  }

  static diffVersions(
    v1: HistoryVersion,
    v2: HistoryVersion,
  ): Record<string, unknown> {
    const changes: Record<string, unknown> = {
      conclusion_changed: v1.new_conclusion !== v2.new_conclusion,
      old_conclusion: conclusionDisplay(v1.new_conclusion),
      new_conclusion: conclusionDisplay(v2.new_conclusion),
      revise_reason: v2.revise_reason,
      new_remarks_in_v2: v2.new_remarks,
      operator: v2.operator,
      operated_at: v2.operated_at,
    };

    const snap1 = (v1.snapshot_material?.materials ?? []) as MaterialReviewItem[];
    const snap2 = (v2.snapshot_material?.materials ?? []) as MaterialReviewItem[];
    const mat1Ids = new Set(snap1.map((m) => m.item_id));
    const mat2Map: Record<string, MaterialReviewItem> = {};
    for (const m of snap2) mat2Map[m.item_id] = m;

    const materialChanges: Record<string, MaterialReviewItem> = {};
    for (const mid of Object.keys(mat2Map)) {
      if (!mat1Ids.has(mid)) materialChanges[mid] = mat2Map[mid];
    }
    changes['material_changes'] = materialChanges;
    return changes;
  }
}

// =============================================================================
// 模块 3：统一渲染源
// =============================================================================

export class UnifiedRenderSource {
  static readonly SOURCE_VERSION = '1.0';

  static build(record: SchemeComparisonRecord): Record<string, unknown> {
    const materialsSummary = record.materials.map((m) => ({
      item_id: m.item_id,
      material_name: m.material_name,
      specification: m.specification,
      collision_count: m.collision_points.length,
      remarks_count: m.remarks.length,
    }));

    const collisionsWithVp = record.materials.flatMap((m) =>
      m.collision_points.map((c) => ({
        collision_id: c.collision_id,
        element_id: c.element_id,
        description: c.description,
        severity: c.severity,
        screenshot: c.screenshot_path,
        viewpoint_fingerprint: viewpointFingerprint(c.viewpoint),
        camera: c.viewpoint,
        historical_screenshots: c.historical_screenshots,
      })),
    );

    const source: Record<string, unknown> = {
      source_version: UnifiedRenderSource.SOURCE_VERSION,
      source_id: record.render_source_id,
      generated_at: _now(),
      record_id: record.record_id,
      project: {
        name: record.project_name,
        code: record.project_code,
        element: record.structural_element,
      },
      status: record.status,
      conclusion: record.conclusion ?? null,
      confidence: record.confidence,
      materials: materialsSummary,
      collisions: collisionsWithVp,
      pending_count: record.pending_queue.filter((p) => !p.resolved_at).length,
      version: record.current_version,
    };
    return source;
  }

  static renderSceneAnnotations(source: Record<string, unknown>): string {
    const project = source['project'] as {
      name: string;
      element: string;
    };
    const collisions = source['collisions'] as Array<{
      severity: Severity;
      description: string;
      element_id: string;
      viewpoint_fingerprint: string;
    }>;
    const pendingCount = source['pending_count'] as number;

    const lines: string[] = [`【${project.name}】${project.element}`];
    for (const col of collisions) {
      lines.push(
        `[${col.severity.toUpperCase()}] ${col.description} ` +
          `(元素:${col.element_id})  [VP:${col.viewpoint_fingerprint.slice(0, 20)}...]`,
      );
    }
    if (pendingCount > 0) {
      lines.push(`⚠ 待确认冲突 ${pendingCount} 组`);
    }
    return lines.join('\n');
  }

  static renderSideNotes(source: Record<string, unknown>): string {
    const status = source['status'] as string;
    const conclusion = source['conclusion'] as Conclusion | undefined;
    const confidence = source['confidence'] as number;
    const version = source['version'] as number;
    const materials = source['materials'] as Array<{
      material_name: string;
      specification: string;
      collision_count: number;
      remarks_count: number;
    }>;
    const collisions = source['collisions'] as Array<{
      severity: Severity;
      description: string;
      screenshot: string;
    }>;
    const pendingCount = source['pending_count'] as number;

    const buf: string[] = [];
    buf.push(`方案比选版本 V${version}  |  状态：${status}`);
    buf.push(
      `结论：${conclusion ? conclusionDisplay(conclusion) : '未出具'}  （置信度 ${(confidence * 100).toFixed(0)}%）`,
    );
    buf.push('');
    buf.push(`材料送审项：${materials.length} 项`);
    for (const m of materials) {
      buf.push(
        `  · ${m.material_name} ${m.specification} — ` +
          `碰撞点 ${m.collision_count} 处，备注 ${m.remarks_count} 条`,
      );
    }
    buf.push('');
    buf.push(`碰撞点总数：${collisions.length}`);
    for (const c of collisions) {
      buf.push(
        `  · [${c.severity}] ${c.description}  截图：${c.screenshot}`,
      );
    }
    if (pendingCount) {
      buf.push('');
      buf.push(`待确认队列：${pendingCount} 组，请先处理后再导出`);
    }
    return buf.join('\n');
  }

  static renderApiResponse(source: Record<string, unknown>): Record<string, unknown> {
    const collisions = source['collisions'] as Array<Record<string, unknown>>;
    return {
      code: 200,
      message: 'ok',
      source_version: source['source_version'],
      source_id: source['source_id'],
      data: {
        record_id: source['record_id'],
        project: source['project'],
        status: source['status'],
        conclusion: source['conclusion'],
        confidence: source['confidence'],
        version: source['version'],
        materials: source['materials'],
        collisions: collisions.map((c) => ({
          collision_id: c['collision_id'],
          element_id: c['element_id'],
          description: c['description'],
          severity: c['severity'],
          camera: c['camera'],
        })),
        pending_count: source['pending_count'],
        generated_at: source['generated_at'],
      },
    };
  }

  static applyToRecord(record: SchemeComparisonRecord): void {
    if (!record.render_source_id) {
      record.render_source_id = `RS-${record.record_id}`;
    }
    const source = UnifiedRenderSource.build(record);
    record.scene_annotations = UnifiedRenderSource.renderSceneAnnotations(source);
    record.side_notes = UnifiedRenderSource.renderSideNotes(source);
    record.api_response = UnifiedRenderSource.renderApiResponse(source);
    record.updated_at = _now();
  }
}

// =============================================================================
// 模块 4：审计日志
// =============================================================================

export class AuditService {
  static log(
    record: SchemeComparisonRecord,
    operator: string,
    opType: OperationType,
    detail: string,
    fieldChanges?: Record<string, Record<string, unknown>>,
  ): AuditLog {
    const log: AuditLog = {
      log_id: _new_id('LOG'),
      record_id: record.record_id,
      operator,
      operation_type: opType,
      operation_detail: detail,
      timestamp: _now(),
      field_changes: fieldChanges ?? {},
    };
    record.audit_logs.push(log);
    return log;
  }

  static filterLogs(
    record: SchemeComparisonRecord,
    params: {
      operator?: string;
      opType?: OperationType;
      since?: string;
      until?: string;
      keyword?: string;
    } = {},
  ): AuditLog[] {
    let result = record.audit_logs;
    if (params.operator) {
      result = result.filter((l) => l.operator === params.operator);
    }
    if (params.opType) {
      result = result.filter((l) => l.operation_type === params.opType);
    }
    if (params.since) {
      const since = params.since;
      result = result.filter((l) => l.timestamp >= since);
    }
    if (params.until) {
      const until = params.until;
      result = result.filter((l) => l.timestamp <= until);
    }
    if (params.keyword) {
      const kw = params.keyword;
      result = result.filter(
        (l) =>
          l.operation_detail.includes(kw) ||
          Object.values(l.field_changes).some((v) =>
            JSON.stringify(v).includes(kw),
          ),
      );
    }
    return result;
  }

  static traceReviseReason(
    record: SchemeComparisonRecord,
    targetVersion: number,
  ): Record<string, unknown> | undefined {
    const hist = HistoryService.getVersion(record, targetVersion);
    if (!hist) return undefined;
    const relatedLogs = AuditService.filterLogs(record, {
      operator: hist.operator,
      opType: OperationTypeEnum.REVISE_CONCLUSION,
      since: hist.operated_at.slice(0, 10),
    });
    return {
      version: hist.version_no,
      operator: hist.operator,
      operated_at: hist.operated_at,
      old_conclusion: conclusionDisplay(hist.old_conclusion),
      new_conclusion: conclusionDisplay(hist.new_conclusion),
      revise_reason: hist.revise_reason,
      new_remarks: hist.new_remarks,
      related_audit_logs: relatedLogs,
    };
  }
}

// =============================================================================
// 模块 5：三栏对账视图
// =============================================================================

export class ReconciliationView {
  static build(record: SchemeComparisonRecord): Record<string, unknown> {
    const source = UnifiedRenderSource.build(record);
    return {
      record_id: record.record_id,
      generated_at: _now(),
      render_source_id: record.render_source_id,
      left_material_review: record.materials.map((m) => ({
        item_id: m.item_id,
        material_name: m.material_name,
        specification: m.specification,
        supplier: m.supplier,
        batch_no: m.batch_no,
        quantity: m.quantity,
        unit: m.unit,
        collision_points: m.collision_points.map((c) => ({
          collision_id: c.collision_id,
          description: c.description,
          severity: c.severity,
          screenshot: c.screenshot_path,
          historical_screenshots: c.historical_screenshots,
          viewpoint_fingerprint: viewpointFingerprint(c.viewpoint),
        })),
        remarks: m.remarks,
        created_at: m.created_at,
        created_by: m.created_by,
      })),
      middle_processing: {
        history_chain: record.history_chain.map((h) => ({
          version_no: h.version_no,
          operator: h.operator,
          operated_at: h.operated_at,
          old_conclusion: conclusionDisplay(h.old_conclusion),
          new_conclusion: conclusionDisplay(h.new_conclusion),
          revise_reason: h.revise_reason,
          new_remarks_count: h.new_remarks.length,
        })),
        audit_logs: record.audit_logs,
        pending_queue: record.pending_queue.map((p) => ({
          pending_id: p.pending_id,
          status: !p.resolved_at ? '待处理' : '已解决',
          impact_analysis: p.impact_analysis,
          affected: p.affected_conclusions,
          suspended_by: p.suspended_by,
          suspended_at: p.suspended_at,
          resolved_by: p.resolved_by,
          resolved_at: p.resolved_at,
          resolution: p.resolution,
        })),
      },
      right_api_response: UnifiedRenderSource.renderApiResponse(source),
    };
  }

  static toText(record: SchemeComparisonRecord): string {
    const view = ReconciliationView.build(record) as {
      record_id: string;
      generated_at: string;
      render_source_id: string;
      left_material_review: Array<{
        item_id: string;
        material_name: string;
        specification: string;
        batch_no: string;
        quantity: number;
        unit: string;
        supplier: string;
        created_by: string;
        created_at: string;
        collision_points: Array<{
          description: string;
          severity: Severity;
          screenshot: string;
          historical_screenshots: unknown[];
          viewpoint_fingerprint: string;
        }>;
        remarks: Array<{ timestamp: string; operator: string; content: string }>;
      }>;
      middle_processing: {
        history_chain: Array<{
          version_no: number;
          old_conclusion: string | undefined;
          new_conclusion: string | undefined;
          revise_reason: string;
          operated_at: string;
          operator: string;
        }>;
        pending_queue: Array<{
          pending_id: string;
          status: string;
          impact_analysis: string;
          affected: Conclusion[];
          suspended_by: string;
          suspended_at: string;
          resolved_by: string | undefined;
          resolution: string | undefined;
        }>;
      };
      right_api_response: {
        data: {
          record_id: string;
          project: { name: string; element: string };
          status: string;
          conclusion: Conclusion | undefined;
          confidence: number;
          version: number;
          materials: unknown[];
          collisions: unknown[];
          pending_count: number;
        };
      };
    };

    const buf: string[] = [];
    buf.push('='.repeat(72));
    buf.push(`结构加固方案比选 - 三栏对账单   记录号：${view.record_id}`);
    buf.push(
      `生成时间：${view.generated_at}   渲染源：${view.render_source_id}`,
    );
    buf.push('='.repeat(72));

    buf.push('\n【左栏 · 材料送审表】');
    for (let i = 0; i < view.left_material_review.length; i++) {
      const m = view.left_material_review[i];
      buf.push(
        `\n  ${i + 1}. ${m.material_name} ${m.specification}  ` +
          `(批号:${m.batch_no}  数量:${m.quantity}${m.unit})`,
      );
      buf.push(`     供应商：${m.supplier}   录入：${m.created_by} @ ${m.created_at}`);
      if (m.collision_points.length > 0) {
        buf.push(`     碰撞点 ${m.collision_points.length} 处：`);
        for (const c of m.collision_points) {
          buf.push(
            `       · [${c.severity}] ${c.description}  ` +
              `截图=${c.screenshot}  VP=${c.viewpoint_fingerprint.slice(0, 24)}...`,
          );
          if (c.historical_screenshots.length > 0) {
            buf.push(
              `         历史截图 ${c.historical_screenshots.length} 张已保留`,
            );
          }
        }
      }
      if (m.remarks.length > 0) {
        buf.push(`     备注 ${m.remarks.length} 条：`);
        for (const r of m.remarks) {
          buf.push(`       · [${r.timestamp}] ${r.operator}: ${r.content}`);
        }
      }
    }

    buf.push('\n' + '-'.repeat(72));
    buf.push('【中栏 · 处理记录】');
    for (const h of view.middle_processing.history_chain) {
      const tag =
        h.old_conclusion !== h.new_conclusion ? '（改判）' : '';
      const vno = String(h.version_no).padStart(2, '0');
      buf.push(
        `  · V${vno}${tag} ${h.operated_at}  ` +
          `${h.operator}: ${h.old_conclusion ?? '无'} → ${h.new_conclusion ?? '无'}`,
      );
      if (h.revise_reason) {
        buf.push(`      原因：${h.revise_reason}`);
      }
    }
    if (view.middle_processing.pending_queue.length > 0) {
      buf.push('  待确认队列：');
      for (const p of view.middle_processing.pending_queue) {
        buf.push(
          `    [${p.status}] ${p.pending_id}  ` +
            `挂起人:${p.suspended_by} @ ${p.suspended_at}`,
        );
        buf.push(`      影响分析：${p.impact_analysis}`);
        if (p.affected.length > 0) {
          buf.push(
            `      牵动结论：${p.affected.map((c) => conclusionDisplay(c)).join(' / ')}`,
          );
        }
        if (p.resolution) {
          buf.push(`      解决：${p.resolved_by} — ${p.resolution}`);
        }
      }
    }

    buf.push('\n' + '-'.repeat(72));
    buf.push('【右栏 · 接口返回】');
    const r = view.right_api_response.data;
    buf.push(`  record_id   : ${r.record_id}`);
    buf.push(`  project     : ${r.project.name} / ${r.project.element}`);
    buf.push(`  status      : ${r.status}`);
    buf.push(
      `  conclusion  : ${conclusionDisplay(r.conclusion) ?? '无'} (置信度 ${(r.confidence * 100).toFixed(0)}%)`,
    );
    buf.push(`  version     : V${r.version}`);
    buf.push(`  materials   : ${r.materials.length} 项`);
    buf.push(`  collisions  : ${r.collisions.length} 处`);
    buf.push(`  pending_cnt : ${r.pending_count}`);

    buf.push('\n' + '='.repeat(72));
    buf.push('▲ 左=材料送审表   中=处理记录   右=接口返回   三处同源，一套话');
    buf.push('='.repeat(72));
    return buf.join('\n');
  }
}

// =============================================================================
// 模块 6：补录 / 改判 门面
// =============================================================================

export function addRemarkToMaterial(
  mat: MaterialReviewItem,
  content: string,
  operator: string,
): Remark {
  const remark: Remark = {
    content,
    operator,
    timestamp: _now(),
  };
  mat.remarks.push(remark);
  return remark;
}

export function createEmptyCollisionPoint(overrides: Partial<CollisionPoint> = {}): CollisionPoint {
  const vp: ViewPoint = overrides.viewpoint ?? {
    camera_position: { x: 0, y: 0, z: 0 },
    camera_target: { x: 0, y: 0, z: 0 },
    camera_up: defaultCameraUp(),
    zoom: 1,
    fov: 45,
  };
  return {
    collision_id: overrides.collision_id ?? _new_id('COL'),
    element_id: overrides.element_id ?? '',
    description: overrides.description ?? '',
    screenshot_path: overrides.screenshot_path ?? '',
    viewpoint: vp,
    severity: overrides.severity ?? 'medium',
    detected_at: overrides.detected_at ?? _now(),
    supplement_note: overrides.supplement_note,
    historical_screenshots: overrides.historical_screenshots ?? [],
  };
}

export function createEmptyMaterial(overrides: Partial<MaterialReviewItem> = {}): MaterialReviewItem {
  return {
    item_id: overrides.item_id ?? _new_id('MAT'),
    material_name: overrides.material_name ?? '',
    specification: overrides.specification ?? '',
    supplier: overrides.supplier ?? '',
    batch_no: overrides.batch_no ?? '',
    quantity: overrides.quantity ?? 0,
    unit: overrides.unit ?? '',
    collision_points: overrides.collision_points ?? [],
    remarks: overrides.remarks ?? [],
    created_at: overrides.created_at ?? _now(),
    created_by: overrides.created_by ?? '',
  };
}

export function createEmptyRecord(overrides: Partial<SchemeComparisonRecord> = {}): SchemeComparisonRecord {
  const ts = _now();
  return {
    record_id: overrides.record_id ?? _new_id('SCM'),
    project_name: overrides.project_name ?? '',
    project_code: overrides.project_code ?? '',
    structural_element: overrides.structural_element ?? '',
    status: overrides.status ?? RecordStatusEnum.ACTIVE,
    conclusion: overrides.conclusion,
    confidence: overrides.confidence ?? 0,
    materials: overrides.materials ?? [],
    history_chain: overrides.history_chain ?? [],
    audit_logs: overrides.audit_logs ?? [],
    pending_queue: overrides.pending_queue ?? [],
    scene_annotations: overrides.scene_annotations ?? '',
    side_notes: overrides.side_notes ?? '',
    api_response: overrides.api_response ?? {},
    render_source_id: overrides.render_source_id ?? '',
    created_at: overrides.created_at ?? ts,
    created_by: overrides.created_by ?? '',
    updated_at: overrides.updated_at ?? ts,
    current_version: overrides.current_version ?? 1,
  };
}

export class SchemeComparisonFacade {
  static createRecord(params: {
    project_name: string;
    project_code: string;
    structural_element: string;
    operator: string;
  }): SchemeComparisonRecord {
    const record = createEmptyRecord({
      project_name: params.project_name,
      project_code: params.project_code,
      structural_element: params.structural_element,
      created_by: params.operator,
    });
    HistoryService.createVersion(record, params.operator, {
      reviseReason: '初始创建',
    });
    AuditService.log(
      record,
      params.operator,
      OperationTypeEnum.CREATE,
      '创建方案比选记录',
    );
    UnifiedRenderSource.applyToRecord(record);
    return record;
  }

  static addMaterial(
    record: SchemeComparisonRecord,
    material: MaterialReviewItem,
    operator: string,
  ): void {
    HistoryService.createVersion(record, operator, {
      reviseReason: `新增材料：${material.material_name}`,
    });
    record.materials.push(material);
    AuditService.log(
      record,
      operator,
      OperationTypeEnum.UPDATE,
      `新增材料送审项 ${material.item_id}: ${material.material_name}`,
      { materials: { added: material.item_id } },
    );
    SuspensionService.suspendForDuplicates(record, operator);
    UnifiedRenderSource.applyToRecord(record);
  }

  static supplementRemark(
    record: SchemeComparisonRecord,
    materialItemId: string,
    remarkContent: string,
    operator: string,
  ): boolean {
    const target = record.materials.find((m) => m.item_id === materialItemId);
    if (!target) return false;
    const newRemark = addRemarkToMaterial(target, remarkContent, operator);
    HistoryService.createVersion(record, operator, {
      reviseReason: `补录备注（材料 ${materialItemId}）`,
      newRemarks: [newRemark],
    });
    AuditService.log(
      record,
      operator,
      OperationTypeEnum.SUPPLEMENT,
      `材料 ${materialItemId} 补录备注：${remarkContent}`,
    );
    UnifiedRenderSource.applyToRecord(record);
    return true;
  }

  static reviseConclusion(
    record: SchemeComparisonRecord,
    params: {
      new_conclusion: Conclusion;
      revise_reason: string;
      operator: string;
      new_confidence?: number;
      extra_remarks?: Remark[];
    },
  ): void {
    const old = record.conclusion;
    HistoryService.createVersion(record, params.operator, {
      reviseReason: params.revise_reason,
      oldConclusion: old,
      newConclusion: params.new_conclusion,
      newRemarks: params.extra_remarks ?? [],
    });
    record.conclusion = params.new_conclusion;
    if (params.new_confidence !== undefined) {
      record.confidence = params.new_confidence;
    }
    AuditService.log(
      record,
      params.operator,
      OperationTypeEnum.REVISE_CONCLUSION,
      `结论改判：${old ? conclusionDisplay(old) : '无'} → ${conclusionDisplay(params.new_conclusion)}；原因：${params.revise_reason}`,
      {
        conclusion: {
          old: old ?? null,
          new: params.new_conclusion,
        },
        confidence: {
          old: record.confidence,
          new: params.new_confidence ?? record.confidence,
        },
      },
    );
    UnifiedRenderSource.applyToRecord(record);
  }

  static exportRecord(
    record: SchemeComparisonRecord,
    operator: string,
  ): Record<string, unknown> {
    UnifiedRenderSource.applyToRecord(record);
    const hasPending = record.pending_queue.some((p) => !p.resolved_at);
    const payload: Record<string, unknown> = {
      record_id: record.record_id,
      export_at: _now(),
      exported_by: operator,
      warnings: hasPending
        ? ['存在未解决的待确认碰撞点，导出数据含挂起标记，请先确认']
        : [],
      render_source_id: record.render_source_id,
      scene_annotations: record.scene_annotations,
      side_notes: record.side_notes,
      api_response: record.api_response,
      reconciliation_text: ReconciliationView.toText(record),
      history_count: record.history_chain.length,
      audit_count: record.audit_logs.length,
    };
    AuditService.log(
      record,
      operator,
      OperationTypeEnum.EXPORT,
      hasPending ? '导出记录（含待确认警告）' : '导出记录',
    );
    return payload;
  }

  static updateCollisionScreenshot(
    record: SchemeComparisonRecord,
    params: {
      materialItemId: string;
      colId: string;
      imageUrl: string;
      appendToHistory?: boolean;
      operator: string;
    },
  ): boolean {
    const mat = record.materials.find((m) => m.item_id === params.materialItemId);
    if (!mat) return false;
    const cp = mat.collision_points.find((c) => c.collision_id === params.colId);
    if (!cp) return false;

    if (params.appendToHistory && cp.screenshot_path) {
      cp.historical_screenshots.push({
        path: cp.screenshot_path,
        captured_at: cp.detected_at,
        viewpoint_fingerprint: viewpointFingerprint(cp.viewpoint),
      });
    }

    cp.screenshot_path = params.imageUrl;

    HistoryService.createVersion(record, params.operator, {
      reviseReason: `更新碰撞点截图（材料 ${params.materialItemId}，碰撞 ${params.colId}）`,
    });
    AuditService.log(
      record,
      params.operator,
      OperationTypeEnum.UPDATE,
      `碰撞点 ${params.colId} 截图更新为 ${params.imageUrl}`,
      {
        screenshot: {
          collision_id: params.colId,
          append_to_history: params.appendToHistory ?? false,
        },
      },
    );
    UnifiedRenderSource.applyToRecord(record);
    return true;
  }

  static updateViewpoint(
    record: SchemeComparisonRecord,
    viewpoint: ViewPoint,
    operator: string,
  ): void {
    if (!viewpoint.camera_up) {
      viewpoint.camera_up = defaultCameraUp();
    }
    for (const mat of record.materials) {
      for (const cp of mat.collision_points) {
        cp.viewpoint = { ...viewpoint };
      }
    }
    HistoryService.createVersion(record, operator, {
      reviseReason: '更新渲染视角（场景标注、侧边说明、接口返回同步）',
    });
    AuditService.log(
      record,
      operator,
      OperationTypeEnum.UPDATE,
      `更新视角参数：${viewpointFingerprint(viewpoint)}`,
      { viewpoint: viewpoint as unknown as Record<string, unknown> },
    );
    SuspensionService.suspendForDuplicates(record, operator);
    UnifiedRenderSource.applyToRecord(record);
  }
}
