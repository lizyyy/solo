import express, { type Request, type Response } from 'express';
import { recordRepository } from '../services/repository.js';
import {
  SchemeComparisonFacade,
  SuspensionService,
  AuditService,
  ReconciliationView,
  createEmptyMaterial,
  createEmptyCollisionPoint,
} from '../services/domain.js';
import {
  type ViewPoint,
  type MaterialReviewItem,
  type CollisionPoint,
  type Conclusion,
  type OperationType,
  defaultCameraUp,
} from '../shared/types.js';
import { createRecord as createViaSeed } from '../services/seed.js';

const router = express.Router();

function getRecordOr404(
  res: Response,
  id: string,
) {
  const rec = recordRepository.get(id);
  if (!rec) {
    res.status(404).json({
      success: false,
      error: `记录不存在: ${id}`,
    });
    return null;
  }
  return rec;
}

function requireBodyField<T = unknown>(
  res: Response,
  body: unknown,
  field: string,
): T | null {
  const val = (body as Record<string, unknown>)[field] as T | undefined;
  if (val === undefined || val === null) {
    res.status(400).json({
      success: false,
      error: `缺少请求参数: ${field}`,
    });
    return null;
  }
  return val;
}

router.get('/', (req: Request, res: Response): void => {
  const summary = recordRepository.listSummary();
  res.status(200).json({
    success: true,
    data: summary,
    total: summary.length,
  });
});

router.get('/:id', (req: Request, res: Response): void => {
  const rec = getRecordOr404(res, req.params.id);
  if (!rec) return;
  res.status(200).json({
    success: true,
    data: rec,
  });
});

router.post('/', (req: Request, res: Response): void => {
  const project_name = requireBodyField<string>(res, req.body, 'project_name');
  if (project_name === null) return;
  const project_code = requireBodyField<string>(res, req.body, 'project_code');
  if (project_code === null) return;
  const structural_element = requireBodyField<string>(
    res,
    req.body,
    'structural_element',
  );
  if (structural_element === null) return;
  const operator = requireBodyField<string>(res, req.body, 'operator');
  if (operator === null) return;

  const record = createViaSeed({
    project_name,
    project_code,
    structural_element,
    operator,
  });

  res.status(201).json({
    success: true,
    data: record,
  });
});

router.put('/:id/viewpoint', (req: Request, res: Response): void => {
  const rec = getRecordOr404(res, req.params.id);
  if (!rec) return;

  const viewpoint = requireBodyField<ViewPoint>(res, req.body, 'viewpoint');
  if (viewpoint === null) return;
  const operator = requireBodyField<string>(res, req.body, 'operator');
  if (operator === null) return;

  const vp: ViewPoint = {
    camera_position: viewpoint.camera_position,
    camera_target: viewpoint.camera_target,
    camera_up: viewpoint.camera_up ?? defaultCameraUp(),
    zoom: Number(viewpoint.zoom),
    fov: Number(viewpoint.fov),
  };

  SchemeComparisonFacade.updateViewpoint(rec, vp, operator);
  recordRepository.save(rec);

  res.status(200).json({
    success: true,
    data: rec,
  });
});

router.post('/:id/materials', (req: Request, res: Response): void => {
  const rec = getRecordOr404(res, req.params.id);
  if (!rec) return;

  const operator = requireBodyField<string>(res, req.body, 'operator');
  if (operator === null) return;

  const body = req.body as Record<string, unknown>;
  const raw = body.material as Partial<MaterialReviewItem> | undefined;
  if (!raw) {
    res.status(400).json({
      success: false,
      error: '缺少请求参数: material',
    });
    return;
  }

  const cps: CollisionPoint[] = (raw.collision_points ?? []).map((c) =>
    createEmptyCollisionPoint({
      ...c,
    }),
  );

  const material: MaterialReviewItem = createEmptyMaterial({
    material_name: raw.material_name ?? '',
    specification: raw.specification ?? '',
    supplier: raw.supplier ?? '',
    batch_no: raw.batch_no ?? '',
    quantity: Number(raw.quantity ?? 0),
    unit: raw.unit ?? '',
    created_by: operator,
    collision_points: cps,
    remarks: raw.remarks ?? [],
    ...(raw.item_id ? { item_id: raw.item_id } : {}),
  });

  SchemeComparisonFacade.addMaterial(rec, material, operator);
  recordRepository.save(rec);

  res.status(201).json({
    success: true,
    data: rec,
  });
});

router.post(
  '/:id/materials/:itemId/remarks',
  (req: Request, res: Response): void => {
    const rec = getRecordOr404(res, req.params.id);
    if (!rec) return;

    const content = requireBodyField<string>(res, req.body, 'content');
    if (content === null) return;
    const operator = requireBodyField<string>(res, req.body, 'operator');
    if (operator === null) return;

    const ok = SchemeComparisonFacade.supplementRemark(
      rec,
      req.params.itemId,
      content,
      operator,
    );
    if (!ok) {
      res.status(404).json({
        success: false,
        error: `材料不存在: ${req.params.itemId}`,
      });
      return;
    }
    recordRepository.save(rec);

    res.status(200).json({
      success: true,
      data: rec,
    });
  },
);

router.post(
  '/:id/materials/:itemId/collisions/:colId/screenshot',
  (req: Request, res: Response): void => {
    const rec = getRecordOr404(res, req.params.id);
    if (!rec) return;

    const body = req.body as Record<string, unknown>;

    const imageUrl =
      body.image_base64_or_url ?? body.imageUrl ?? body.image_url;
    if (!imageUrl || typeof imageUrl !== 'string') {
      res.status(400).json({
        success: false,
        error: '缺少请求参数: image_base64_or_url',
      });
      return;
    }
    const operator = requireBodyField<string>(res, req.body, 'operator');
    if (operator === null) return;
    const appendToHistory = Boolean(body.append_to_history ?? body.appendToHistory ?? true);

    const ok = SchemeComparisonFacade.updateCollisionScreenshot(rec, {
      materialItemId: req.params.itemId,
      colId: req.params.colId,
      imageUrl,
      appendToHistory,
      operator,
    });
    if (!ok) {
      res.status(404).json({
        success: false,
        error: `材料或碰撞点不存在`,
      });
      return;
    }
    recordRepository.save(rec);

    res.status(200).json({
      success: true,
      data: rec,
    });
  },
);

router.post(
  '/:id/pending/:pendingId/resolve',
  (req: Request, res: Response): void => {
    const rec = getRecordOr404(res, req.params.id);
    if (!rec) return;

    const resolution = requireBodyField<string>(res, req.body, 'resolution');
    if (resolution === null) return;
    const operator = requireBodyField<string>(res, req.body, 'operator');
    if (operator === null) return;

    const body = req.body as Record<string, unknown>;
    const keepCollisionId = body.keep_collision_id as string | undefined;

    const ok = SuspensionService.resolvePending(
      rec,
      req.params.pendingId,
      operator,
      resolution,
      keepCollisionId,
    );
    if (!ok) {
      res.status(404).json({
        success: false,
        error: `待确认项不存在或已解决: ${req.params.pendingId}`,
      });
      return;
    }
    recordRepository.save(rec);

    res.status(200).json({
      success: true,
      data: rec,
    });
  },
);

router.post('/:id/revise', (req: Request, res: Response): void => {
  const rec = getRecordOr404(res, req.params.id);
  if (!rec) return;

  const newConclusion = requireBodyField<Conclusion>(res, req.body, 'new_conclusion');
  if (newConclusion === null) return;
  const reviseReason = requireBodyField<string>(res, req.body, 'revise_reason');
  if (reviseReason === null) return;
  const operator = requireBodyField<string>(res, req.body, 'operator');
  if (operator === null) return;

  const body = req.body as Record<string, unknown>;
  const newConf = body.new_confidence as number | undefined;
  const extraRemarksRaw = body.extra_remarks as unknown;
  const extraRemarks = Array.isArray(extraRemarksRaw)
    ? (extraRemarksRaw as import('../shared/types.js').Remark[])
    : undefined;

  SchemeComparisonFacade.reviseConclusion(rec, {
    new_conclusion: newConclusion,
    revise_reason: reviseReason,
    operator,
    new_confidence: newConf !== undefined ? Number(newConf) : undefined,
    extra_remarks: extraRemarks,
  });
  recordRepository.save(rec);

  res.status(200).json({
    success: true,
    data: rec,
  });
});

router.get('/:id/export', (req: Request, res: Response): void => {
  const rec = getRecordOr404(res, req.params.id);
  if (!rec) return;

  const operator = (req.query.operator as string | undefined) ?? '匿名导出';

  const payload = SchemeComparisonFacade.exportRecord(rec, operator);
  recordRepository.save(rec);

  const { reconciliation_text, ...rest } = payload;
  const accept = req.headers.accept ?? '';
  if (String(accept).includes('text/plain')) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.status(200).send(reconciliation_text as string);
    return;
  }

  res.status(200).json({
    success: true,
    data: {
      ...rest,
      reconciliation_text,
      reconciliation_view: ReconciliationView.build(rec),
    },
  });
});

router.get('/:id/audit', (req: Request, res: Response): void => {
  const rec = getRecordOr404(res, req.params.id);
  if (!rec) return;

  const operatorFilter = req.query.operator as string | undefined;
  const opType = req.query.op_type as OperationType | undefined;
  const keyword = req.query.keyword as string | undefined;

  const logs = AuditService.filterLogs(rec, {
    operator: operatorFilter,
    opType,
    keyword,
  });

  res.status(200).json({
    success: true,
    data: logs,
    total: logs.length,
  });
});

export default router;
