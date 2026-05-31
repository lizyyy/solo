import type {
  Clip,
  ClipStatus,
  CreateClipRequest,
  UpdateClipRequest,
  UpdateStatusRequest,
  AddMaterialRequest,
  Material,
  ChangeLog,
  PendingReason,
  ExportManifest,
  ExportMissingItem,
  User,
} from '../../shared/types';
import {
  generateId,
  STATUS_TRANSITION_RULES,
  getSourceResponsiblePerson,
} from '../../shared/constants';
import {
  getClipsStore,
  updateClipInStore,
  addClipToStore,
  getUsersStore,
} from '../data/mockData';

function findUserById(userId: string): User | undefined {
  return getUsersStore().find(u => u.id === userId);
}

function canTransitionStatus(currentStatus: ClipStatus, newStatus: ClipStatus): boolean {
  if (newStatus === 'pending') return true;
  return STATUS_TRANSITION_RULES[currentStatus]?.includes(newStatus) ?? false;
}

function createChangeLog(
  clipId: string,
  operatorId: string,
  changeType: UpdateClipRequest['changeType'],
  sourceType: UpdateClipRequest['sourceType'],
  oldValue: string | undefined,
  newValue: string | undefined,
  reason?: string,
): ChangeLog {
  const operator = findUserById(operatorId);
  return {
    id: generateId(),
    clipId,
    operatorId,
    operatorName: operator?.name ?? '未知用户',
    changeType,
    sourceType,
    oldValue,
    newValue,
    reason,
    timestamp: new Date(),
  };
}

export function getAllClips(
  filters?: { status?: ClipStatus; keyword?: string },
): Clip[] {
  let clips = getClipsStore();

  if (filters?.status) {
    clips = clips.filter(c => c.status === filters.status);
  }

  if (filters?.keyword) {
    const kw = filters.keyword.toLowerCase();
    clips = clips.filter(
      c =>
        c.title.toLowerCase().includes(kw) ||
        c.guest.toLowerCase().includes(kw) ||
        c.episode.toLowerCase().includes(kw),
    );
  }

  return clips;
}

export function getClipById(id: string): Clip | undefined {
  return getClipsStore().find(c => c.id === id);
}

export function createClip(request: CreateClipRequest): Clip {
  const operator = findUserById(request.operatorId);
  const now = new Date();

  const clip: Clip = {
    id: `clip-${Date.now()}`,
    title: request.title,
    guest: request.guest,
    episode: request.episode,
    duration: request.duration,
    status: 'pending_ad_script',
    createdBy: request.operatorId,
    createdAt: now,
    updatedBy: request.operatorId,
    updatedAt: now,
    editPointContent: request.editPointContent,
    pendingReasons: [],
    changeLogs: [
      {
        id: generateId(),
        clipId: '',
        operatorId: request.operatorId,
        operatorName: operator?.name ?? '未知用户',
        changeType: 'conclusion_change',
        sourceType: 'edit_point',
        oldValue: undefined,
        newValue: '剪辑点内容已录入',
        timestamp: now,
      },
    ],
    materials: [],
  };

  clip.changeLogs[0].clipId = clip.id;

  addClipToStore(clip);
  return clip;
}

export function updateClip(id: string, request: UpdateClipRequest): Clip | null {
  const clip = getClipById(id);
  if (!clip) return null;

  const changeLog = createChangeLog(
    id,
    request.operatorId,
    request.changeType,
    request.sourceType,
    request.sourceType === 'edit_point' ? clip.editPointContent :
    request.sourceType === 'ad_script' ? clip.adScriptContent :
    clip.audioTrackBefore,
    request.sourceType === 'edit_point' ? request.editPointContent :
    request.sourceType === 'ad_script' ? request.adScriptContent :
    request.audioTrackAfter,
    request.reason,
  );

  if (request.title !== undefined) clip.title = request.title;
  if (request.guest !== undefined) clip.guest = request.guest;
  if (request.episode !== undefined) clip.episode = request.episode;
  if (request.duration !== undefined) clip.duration = request.duration;
  if (request.editPointContent !== undefined) clip.editPointContent = request.editPointContent;
  if (request.adScriptContent !== undefined) clip.adScriptContent = request.adScriptContent;
  if (request.audioTrackBefore !== undefined) clip.audioTrackBefore = request.audioTrackBefore;
  if (request.audioTrackAfter !== undefined) clip.audioTrackAfter = request.audioTrackAfter;

  if (clip.status === 'pending_ad_script' && clip.adScriptContent) {
    clip.status = 'pending_review';
  }

  if (request.sourceType === 'audio_track' && request.audioTrackAfter) {
    if (!clip.audioTrackBefore) {
      clip.audioTrackBefore = request.audioTrackBefore ?? '原始版本';
    }
  }

  clip.updatedBy = request.operatorId;
  clip.updatedAt = new Date();
  clip.changeLogs.unshift(changeLog);

  updateClipInStore(clip);
  return clip;
}

export function updateClipStatus(
  id: string,
  request: UpdateStatusRequest,
): Clip | null {
  const clip = getClipById(id);
  if (!clip) return null;

  if (!canTransitionStatus(clip.status, request.status)) {
    return null;
  }

  const operator = findUserById(request.operatorId);
  const oldStatus = clip.status;
  const now = new Date();

  clip.status = request.status;
  clip.updatedBy = request.operatorId;
  clip.updatedAt = now;

  if (request.status === 'pending' && request.reason) {
    const pendingReason: PendingReason = {
      id: generateId(),
      clipId: id,
      operatorId: request.operatorId,
      operatorName: operator?.name ?? '未知用户',
      reason: request.reason,
      timestamp: now,
      resolved: false,
    };
    clip.pendingReasons.unshift(pendingReason);
  }

  if (request.status === 'pending_review') {
    const latestPending = clip.pendingReasons.find(p => !p.resolved);
    if (latestPending) {
      latestPending.resolved = true;
      latestPending.resolvedAt = now;
      latestPending.resolvedBy = request.operatorId;
    }
  }

  const changeLog: ChangeLog = {
    id: generateId(),
    clipId: id,
    operatorId: request.operatorId,
    operatorName: operator?.name ?? '未知用户',
    changeType: 'conclusion_change',
    sourceType: 'edit_point',
    oldValue: oldStatus,
    newValue: request.status,
    reason: request.reason,
    timestamp: now,
  };
  clip.changeLogs.unshift(changeLog);

  updateClipInStore(clip);
  return clip;
}

export function getClipChangeLogs(id: string): ChangeLog[] | null {
  const clip = getClipById(id);
  if (!clip) return null;
  return clip.changeLogs;
}

export function getClipMaterials(id: string): Material[] | null {
  const clip = getClipById(id);
  if (!clip) return null;
  return clip.materials;
}

export function addMaterial(
  clipId: string,
  request: AddMaterialRequest,
): Material | null {
  const clip = getClipById(clipId);
  if (!clip) return null;

  const operator = findUserById(request.operatorId);
  const now = new Date();

  const material: Material = {
    id: generateId(),
    clipId,
    name: request.name,
    sourceType: request.sourceType,
    status: request.url ? 'available' : 'missing',
    url: request.url,
    uploadedBy: request.url ? request.operatorId : undefined,
    uploadedAt: request.url ? now : undefined,
    remark: request.remark,
  };

  clip.materials.push(material);
  clip.updatedBy = request.operatorId;
  clip.updatedAt = now;

  const changeLog: ChangeLog = {
    id: generateId(),
    clipId,
    operatorId: request.operatorId,
    operatorName: operator?.name ?? '未知用户',
    changeType: 'material_only',
    sourceType: request.sourceType,
    oldValue: undefined,
    newValue: `添加素材：${request.name}`,
    reason: request.remark,
    timestamp: now,
  };
  clip.changeLogs.unshift(changeLog);

  updateClipInStore(clip);
  return material;
}

export function checkExport(
  clipIds: string[],
  operatorId: string,
): ExportManifest | null {
  const operator = findUserById(operatorId);
  if (!operator) return null;

  const clips = clipIds
    .map(id => getClipById(id))
    .filter((c): c is Clip => c !== undefined);

  const missingItems: ExportMissingItem[] = [];

  for (const clip of clips) {
    for (const material of clip.materials) {
      if (material.status === 'missing') {
        const responsiblePerson = getSourceResponsiblePerson(material.sourceType);
        if (responsiblePerson) {
          missingItems.push({
            materialId: material.id,
            materialName: material.name,
            sourceType: material.sourceType,
            responsiblePerson,
          });
        }
      }
    }
  }

  return {
    id: generateId(),
    clipIds,
    generatedAt: new Date(),
    generatedBy: operatorId,
    missingItems,
    canExport: missingItems.length === 0,
  };
}

export function exportManifest(
  clipIds: string[],
  operatorId: string,
): { url: string; manifest: ExportManifest } | null {
  const manifest = checkExport(clipIds, operatorId);
  if (!manifest) return null;

  return {
    url: `/api/export/download/${manifest.id}`,
    manifest,
  };
}

export function getAllUsers(): User[] {
  return getUsersStore();
}
