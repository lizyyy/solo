process.removeAllListeners('warning');

import { TrackRepo } from '../repos/trackRepo.js';
import { MaterialRepo } from '../repos/materialRepo.js';
import { RevisionRepo } from '../repos/revisionRepo.js';
import type {
  Track,
  Material,
  Revision,
  TimelineNode,
  TrackStatus,
  MaterialType,
} from '../../shared/types.js';
import { STATUS_LABEL, ISSUE_LABEL, MATERIAL_LABEL } from '../../shared/types.js';

export interface ReviseTrackInput {
  trackId: string;
  newStatus: TrackStatus;
  reviseReason: string;
  note?: string;
  operator: string;
  newMaterials?: Array<{
    type: MaterialType;
    fileName: string;
    filePath: string;
    fileSize: number;
    summary: string;
    uploadedBy: string;
  }>;
}

export interface ReviseTrackResult {
  track: Track;
  revision: Revision;
}

export const TrackService = {
  getTimeline(trackId: string): TimelineNode[] {
    const track = TrackRepo.getById(trackId);
    if (!track) return [];

    const materials = MaterialRepo.listByTrackId(trackId);
    const revisions = RevisionRepo.listByTrackId(trackId);
    const nodes: TimelineNode[] = [];

    nodes.push({
      id: `create-${track.id}`,
      type: 'create',
      timestamp: track.createdAt,
      operator: track.lastOperator,
      title: '建立追踪档案',
      summary: `宠物「${track.petName}」${(ISSUE_LABEL as any)[track.issueType] || track.issueType}，状态：${(STATUS_LABEL as any)[track.status] || track.status}`,
      details: {
        statusChange: { old: null, new: track.status },
        note: track.currentNote,
        materials: materials
          .filter((m) => m.version === 1 && !m.replacedMaterialId)
          .map((m) => ({
            id: m.id,
            name: m.fileName,
            version: m.version,
            changed: m.hasConsistencyChange,
          })),
      },
    });

    for (const rev of revisions) {
      const revMaterials = materials.filter((m) => rev.newMaterialIds.includes(m.id));
      nodes.push({
        id: `revise-${rev.id}`,
        type: 'revise',
        timestamp: rev.createdAt,
        operator: rev.operator,
        title: `第${rev.version}次修订`,
        summary: rev.reviseReason,
        details: {
          statusChange: rev.oldStatus
            ? { old: rev.oldStatus, new: rev.newStatus }
            : undefined,
          reviseReason: rev.reviseReason,
          note: rev.noteSnapshot,
          materials: revMaterials.map((m) => ({
            id: m.id,
            name: m.fileName,
            version: m.version,
            changed: m.hasConsistencyChange,
          })),
        },
      });
    }

    const uploadedMaterials = materials.filter(
      (m) =>
        m.version > 1 ||
        (m.version === 1 &&
          !nodes.some((n) =>
            n.details.materials?.some((nm) => nm.id === m.id),
          )),
    );

    for (const mat of uploadedMaterials) {
      nodes.push({
        id: `upload-${mat.id}`,
        type: 'upload',
        timestamp: mat.uploadedAt,
        operator: mat.uploadedBy,
        title: `上传${(MATERIAL_LABEL as any)[mat.type] || mat.type}`,
        summary: mat.summary,
        details: {
          materials: [
            {
              id: mat.id,
              name: mat.fileName,
              version: mat.version,
              changed: mat.hasConsistencyChange,
            },
          ],
          note: mat.consistencyChangeNote,
        },
      });
    }

    nodes.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    return nodes;
  },

  reviseTrack(input: ReviseTrackInput): ReviseTrackResult | null {
    const track = TrackRepo.getById(input.trackId);
    if (!track) return null;

    const newRevisionCount = track.revisionCount + 1;
    const oldStatus = track.status;
    const newNote = input.note ?? track.currentNote;
    const newMaterialIds: string[] = [];

    if (input.newMaterials && input.newMaterials.length > 0) {
      const createdMaterials = MaterialRepo.bulkCreate(
        input.newMaterials.map((m) => ({
          ...m,
          trackId: input.trackId,
        })),
      );
      for (const m of createdMaterials) {
        newMaterialIds.push(m.id);
      }
    }

    const revision = RevisionRepo.create({
      trackId: input.trackId,
      version: newRevisionCount,
      oldStatus,
      newStatus: input.newStatus,
      reviseReason: input.reviseReason,
      noteSnapshot: newNote,
      operator: input.operator,
      newMaterialIds,
    });

    const updatedTrack = TrackRepo.update(input.trackId, {
      status: input.newStatus,
      currentNote: newNote,
      revisionCount: newRevisionCount,
      lastOperator: input.operator,
    })!;

    return {
      track: {
        ...updatedTrack,
        materials: MaterialRepo.listByTrackId(input.trackId),
      },
      revision,
    };
  },

  getHandoffText(trackId: string): string {
    const track = TrackRepo.getById(trackId);
    if (!track) return '';

    const materials = MaterialRepo.listByTrackId(trackId);
    const revisions = RevisionRepo.listByTrackId(trackId);
    const statusLabel = (STATUS_LABEL as any)[track.status] || track.status;
    const issueLabel = (ISSUE_LABEL as any)[track.issueType] || track.issueType;

    const lines: string[] = [];
    lines.push(`【交班报告】${track.petName} - ${issueLabel}`);
    lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`档案编号：${track.id}`);
    lines.push(`宠物别名：${track.aliases.join('、') || '无'}`);
    lines.push(`初诊日期：${track.initialVisitDate}`);
    lines.push(`当前状态：${statusLabel}`);
    lines.push(`修订次数：${track.revisionCount}次`);
    lines.push(`最后操作：${track.lastOperator} @ ${track.updatedAt}`);
    if (track.abnormalReason) {
      lines.push(`⚠️  异常提醒：${track.abnormalReason}`);
    }
    if (track.aliasWarning) {
      lines.push(`⚠️  别名冲突警告：存在同名宠物档案`);
    }
    lines.push('');
    lines.push(`【当前记录】`);
    lines.push(track.currentNote || '（无）');
    lines.push('');

    if (revisions.length > 0) {
      lines.push(`【修订历史】`);
      for (const rev of revisions) {
        const oldLabel = rev.oldStatus
          ? (STATUS_LABEL as any)[rev.oldStatus] || rev.oldStatus
          : '新建';
        const newLabel = (STATUS_LABEL as any)[rev.newStatus] || rev.newStatus;
        lines.push(
          `• 第${rev.version}次 [${rev.createdAt}] ${rev.operator}：${oldLabel} → ${newLabel}`,
        );
        lines.push(`  原因：${rev.reviseReason}`);
        if (rev.newMaterialIds.length > 0) {
          const revMats = materials.filter((m) => rev.newMaterialIds.includes(m.id));
          lines.push(`  新材料：${revMats.map((m) => m.fileName).join('、')}`);
        }
      }
      lines.push('');
    }

    if (materials.length > 0) {
      lines.push(`【材料清单】共${materials.length}份`);
      for (const m of materials) {
        const typeLabel = (MATERIAL_LABEL as any)[m.type] || m.type;
        const replaced = m.replacedMaterialId ? '（已替换）' : '';
        const changed = m.hasConsistencyChange ? '⚠️一致性变更' : '';
        lines.push(`• [${typeLabel}] v${m.version} ${m.fileName} ${replaced}${changed}`);
        if (m.summary) lines.push(`  摘要：${m.summary}`);
      }
    }

    return lines.join('\n');
  },
};
