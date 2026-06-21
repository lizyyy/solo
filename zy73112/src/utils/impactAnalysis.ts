import type {
  BimNote,
  CollisionPoint,
  MaterialChange,
  BimComponent,
  ChangeImpactResult,
  DuplicateEvidence,
  CameraView,
} from '../types';

const SCREENSHOT_PROMPTS = [
  'BIM 3D model collision detection between fire protection pipe and ventilation duct technical drawing style',
  'BIM mechanical electrical plumbing coordination clash detection isometric view',
  'Building information modeling 3D coordination clash point visualization',
  'BIM construction site collision between structural beam and MEP systems',
];

export function analyzeChangeImpact(
  bimNote: BimNote,
  existingCollisions: CollisionPoint[],
  existingMaterialChanges: MaterialChange[],
  components: BimComponent[]
): ChangeImpactResult {
  const relatedComponents = findRelatedComponents(bimNote, components);

  const { newCollisions, duplicateCollisions } = detectCollisions(
    bimNote,
    relatedComponents,
    existingCollisions
  );

  const affectedMaterialChanges = findAffectedMaterialChanges(
    bimNote,
    relatedComponents,
    existingMaterialChanges
  );

  const newJudgements = generateChangedJudgements(bimNote, relatedComponents, newCollisions);

  const { sceneAnnotation, sideNote, pageSummary } = generateUnifiedContent(
    bimNote,
    newCollisions,
    newJudgements,
    duplicateCollisions.length
  );

  return {
    newCollisions,
    duplicateCollisions,
    affectedMaterialChanges,
    newJudgements,
    updatedSceneAnnotation: sceneAnnotation,
    updatedSideNote: sideNote,
    updatedPageSummary: pageSummary,
  };
}

function extractKeywords(text: string): string[] {
  const keywords: string[] = [];
  const patterns = [
    /消防|水管|喷淋|fire|pipe|sprinkler/gi,
    /通风|风管|空调|duct|ventilation|hvac/gi,
    /结构|梁|板|柱|beam|slab|column|structure/gi,
    /电气|桥架|电缆|electric|cable|tray/gi,
    /排水|污水|雨水|drain|sewage|rainwater/gi,
    /石材|面砖|涂料|stone|tile|paint/gi,
    /碰撞|冲突|clash|collision/gi,
    /变更|修改|调整|change|modify|adjust/gi,
  ];

  patterns.forEach((pattern) => {
    const matches = text.match(pattern);
    if (matches) {
      keywords.push(...[...new Set(matches.map((m) => m.toLowerCase()))]);
    }
  });

  return keywords;
}

function findRelatedComponents(bimNote: BimNote, components: BimComponent[]): BimComponent[] {
  const keywords = extractKeywords(bimNote.content + ' ' + bimNote.title);
  const typeMap: Record<string, BimComponent['type']> = {
    '消防': 'pipe', '水管': 'pipe', '喷淋': 'pipe', 'pipe': 'pipe',
    '通风': 'duct', '风管': 'duct', '空调': 'duct', 'duct': 'duct',
    '结构': 'beam', '梁': 'beam', 'beam': 'beam', 'slab': 'floor',
    '电气': 'other', '桥架': 'other', 'electric': 'other',
    '排水': 'pipe', '污水': 'pipe', 'drain': 'pipe',
  };

  const types = new Set<BimComponent['type']>();
  keywords.forEach((kw) => {
    if (typeMap[kw]) types.add(typeMap[kw]);
  });

  if (types.size === 0) {
    return components.slice(0, 5);
  }

  const noteLocation = bimNote.location || { x: 100, y: -80, z: 30 };
  return components
    .filter((c) => types.has(c.type))
    .sort((a, b) => {
      const distA = distance3D(a.position, noteLocation);
      const distB = distance3D(b.position, noteLocation);
      return distA - distB;
    })
    .slice(0, 6);
}

function distance3D(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number {
  return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2) + Math.pow(a.z - b.z, 2));
}

function detectCollisions(
  bimNote: BimNote,
  relatedComponents: BimComponent[],
  existingCollisions: CollisionPoint[]
): { newCollisions: CollisionPoint[]; duplicateCollisions: string[] } {
  const newCollisions: CollisionPoint[] = [];
  const duplicateCollisions: string[] = [];

  if (relatedComponents.length < 2) {
    return { newCollisions, duplicateCollisions };
  }

  const numCollisions = Math.min(3, Math.floor(relatedComponents.length / 2));

  for (let i = 0; i < numCollisions; i++) {
    const compA = relatedComponents[i * 2];
    const compB = relatedComponents[i * 2 + 1];
    if (!compA || !compB) continue;

    const collisionPos = {
      x: (compA.position.x + compB.position.x) / 2,
      y: (compA.position.y + compB.position.y) / 2,
      z: (compA.position.z + compB.position.z) / 2,
    };

    const cameraView: CameraView = {
      position: {
        x: collisionPos.x + 25 + i * 5,
        y: collisionPos.y - 30 - i * 3,
        z: collisionPos.z + 20,
      },
      rotation: { x: -28 - i * 2, y: 42 + i * 5, z: 0 },
      zoom: 1.1 + i * 0.1,
    };

    const screenshotIdx = i % SCREENSHOT_PROMPTS.length;
    const screenshotUrl = `https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=${encodeURIComponent(
      SCREENSHOT_PROMPTS[screenshotIdx]
    )}&image_size=square_hd`;

    const { isDuplicate, duplicateOf, evidence } = checkDuplicate(
      collisionPos,
      cameraView,
      bimNote,
      compA,
      compB,
      existingCollisions
    );

    const collision: CollisionPoint = {
      id: '',
      name: `${compA.name} 与 ${compB.name} 碰撞`,
      description: `${compA.type === 'pipe' ? '管道' : compA.type === 'duct' ? '风管' : '构件'}${compA.name}与${
        compB.type === 'beam' ? '结构梁' : compB.name
      }发生碰撞，需调整路由或标高。`,
      bimNoteId: bimNote.id,
      screenshotUrl,
      cameraView,
      isDuplicate,
      duplicateOf,
      duplicateReason: isDuplicate ? '空间位置相近，疑似同一碰撞点' : undefined,
      duplicateEvidence: evidence,
      affectedItems: isDuplicate ? ['材料工程量统计', '施工进度计划'] : undefined,
      needsManualReview: isDuplicate,
      status: isDuplicate ? 'needs_review' : 'pending',
      createdAt: '',
      updatedAt: '',
      componentIds: [compA.id, compB.id],
      position: collisionPos,
    };

    if (isDuplicate && duplicateOf) {
      duplicateCollisions.push(duplicateOf);
    }
    newCollisions.push(collision);
  }

  return { newCollisions, duplicateCollisions };
}

function checkDuplicate(
  position: { x: number; y: number; z: number },
  cameraView: CameraView,
  bimNote: BimNote,
  compA: BimComponent,
  compB: BimComponent,
  existingCollisions: CollisionPoint[]
): { isDuplicate: boolean; duplicateOf?: string; evidence?: DuplicateEvidence } {
  for (const existing of existingCollisions) {
    const spatialDist = distance3D(position, existing.position);
    const angleDiff = Math.abs(cameraView.rotation.y - existing.cameraView.rotation.y);
    const sameNote = existing.bimNoteId === bimNote.id;

    const hasCommonComponents = existing.componentIds.some(
      (id) => id === compA.id || id === compB.id
    );

    if (spatialDist < 3.0 && hasCommonComponents) {
      return {
        isDuplicate: true,
        duplicateOf: existing.id,
        evidence: {
          componentIds: [compA.id, compB.id, ...existing.componentIds].filter(
            (v, i, a) => a.indexOf(v) === i
          ),
          spatialDistance: parseFloat(spatialDist.toFixed(2)),
          sameBimNote: sameNote,
          similarCameraAngle: angleDiff < 15,
        },
      };
    }
  }

  return { isDuplicate: false };
}

function findAffectedMaterialChanges(
  bimNote: BimNote,
  _relatedComponents: BimComponent[],
  existingMaterialChanges: MaterialChange[]
): string[] {
  const affected: string[] = [];
  const noteKeywords = extractKeywords(bimNote.content + ' ' + bimNote.title);

  for (const mc of existingMaterialChanges) {
    if (mc.isBadData) continue;

    const mcKeywords = extractKeywords(mc.title + ' ' + mc.description);
    const common = noteKeywords.filter((k) => mcKeywords.includes(k));

    if (common.length >= 2) {
      affected.push(mc.id);
    }
  }

  return affected;
}

function generateChangedJudgements(
  bimNote: BimNote,
  relatedComponents: BimComponent[],
  newCollisions: CollisionPoint[]
): string[] {
  const judgements: string[] = [];

  if (newCollisions.length > 0) {
    judgements.push(
      `原判断${relatedComponents.length}个构件可以正常安装，实际检测到${newCollisions.length}处碰撞需要整改`
    );
  }

  if (bimNote.content.includes('材料') || bimNote.content.includes('变更')) {
    judgements.push('原判断材料规格和用量不变，现因设计调整需重新计算材料用量');
  }

  if (bimNote.content.includes('标高') || bimNote.content.includes('高度')) {
    judgements.push('原设计标高需调整，可能影响净高要求和相关专业配合');
  }

  if (bimNote.tags.some((t) => t.includes('结构') || t.includes('钢结构'))) {
    judgements.push('结构方案调整，需复核承载力和用钢量变化');
  }

  if (judgements.length === 0) {
    judgements.push(`根据BIM备注"${bimNote.title}"，需重新评估相关设计判断`);
  }

  return judgements;
}

function generateUnifiedContent(
  bimNote: BimNote,
  collisions: CollisionPoint[],
  judgements: string[],
  duplicateCount: number
): { sceneAnnotation: string; sideNote: string; pageSummary: string } {
  const validCount = collisions.filter((c) => !c.isDuplicate).length;

  const sceneAnnotation = `${bimNote.title}，涉及${validCount}个碰撞点${
    duplicateCount > 0 ? `（含${duplicateCount}个疑似重复待确认）` : ''
  }，调整位置示意。`;

  const sideNote = `本变更源自BIM备注"${bimNote.title}"。涉及${
    collisions.length
  }个碰撞检测点${
    duplicateCount > 0 ? `，其中${duplicateCount}个疑似重复需人工确认` : ''
  }。${bimNote.content.slice(0, 80)}${bimNote.content.length > 80 ? '...' : ''}`;

  const statusText = duplicateCount > 0 ? '待人工确认重复项后统计' : '待确认';
  const pageSummary = `${bimNote.title}共涉及${collisions.length}个碰撞检测点，${
    judgements.length
  }项设计判断变更。当前状态：${statusText}。${
    duplicateCount > 0 ? '注意：存在疑似重复碰撞点，需人工确认后更新最终数量。' : ''
  }`;

  return { sceneAnnotation, sideNote, pageSummary };
}

export function generateExportData(
  materialChanges: MaterialChange[],
  bimNotes: BimNote[],
  collisions: CollisionPoint[],
  config: {
    statusFilter?: string;
    includeCameraView?: boolean;
    includeOriginalBimNote?: boolean;
    includeExceptionNotes?: boolean;
  }
): any[] {
  const filtered =
    config.statusFilter && config.statusFilter !== 'all'
      ? materialChanges.filter((m) => m.status === config.statusFilter)
      : materialChanges.filter((m) => !m.isBadData);

  return filtered.map((mc) => {
    const bimNote = bimNotes.find((b) => b.id === mc.bimNoteId);
    const relatedCollisions = collisions.filter((c) => mc.collisionPointIds.includes(c.id));

    const record: any = {
      id: mc.id,
      title: mc.title,
      description: mc.description,
      status: mc.status,
      statusText: getStatusText(mc.status),
      materials: mc.materials.map((m) => `${m.name} ${m.spec} ×${m.quantity}${m.unit}`).join('; '),
      materialCount: mc.materials.length,
      collisionCount: relatedCollisions.length,
      duplicateCount: relatedCollisions.filter((c) => c.isDuplicate).length,
      author: mc.author,
      reviewer: mc.reviewer || '-',
      createdAt: mc.createdAt,
      updatedAt: mc.updatedAt,
      pageSummary: mc.pageSummary,
      sideNote: mc.sideNote,
      sceneAnnotation: mc.sceneAnnotation,
    };

    if (config.includeOriginalBimNote && bimNote) {
      record.originalBimNoteId = bimNote.id;
      record.originalBimNoteTitle = bimNote.title;
      record.originalBimNoteContent = bimNote.content;
      record.originalBimNoteAuthor = bimNote.author;
    }

    if (config.includeCameraView) {
      record.cameraViews = relatedCollisions.map((c) => ({
        collisionId: c.id,
        position: c.cameraView.position,
        rotation: c.cameraView.rotation,
        zoom: c.cameraView.zoom,
      }));
    }

    if (config.includeExceptionNotes) {
      record.changedJudgements = mc.changedJudgements;
      if (mc.isBadData) {
        record.badDataReason = mc.badDataReason;
        record.badDataClue = mc.badDataClue;
      }
      const duplicates = relatedCollisions.filter((c) => c.isDuplicate);
      if (duplicates.length > 0) {
        record.duplicateInfo = duplicates.map((d) => ({
          id: d.id,
          reason: d.duplicateReason,
          duplicateOf: d.duplicateOf,
        }));
      }
    }

    return record;
  });
}

function getStatusText(status: string): string {
  const map: Record<string, string> = {
    pending: '待确认',
    confirmed: '已确认',
    supplement: '待补件',
    returned: '已退回',
    bad_data: '坏数据',
    needs_review: '需人工确认',
  };
  return map[status] || status;
}

export function exportToCSV(data: any[]): string {
  if (data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const headerRow = headers.join(',');

  const rows = data.map((item) =>
    headers
      .map((h) => {
        let val = item[h];
        if (typeof val === 'object' && val !== null) {
          val = JSON.stringify(val);
        }
        val = String(val).replace(/"/g, '""');
        return `"${val}"`;
      })
      .join(',')
  );

  return [headerRow, ...rows].join('\n');
}

export function downloadFile(content: string, filename: string, mimeType: string = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
