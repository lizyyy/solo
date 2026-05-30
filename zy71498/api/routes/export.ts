import express from 'express';
import XLSX from 'xlsx';
import jsPDF from 'jspdf';
import fs from 'fs';
import path from 'path';
import type { ReviewReport } from '../../shared/types';
import { getTracks, getConflicts, getImportBatches, getDashboardStats } from '../store';
import { detectDuplicateSubmission } from '../utils/conflictDetection';

const router = express.Router();

const EXPORT_DIR = path.join(process.cwd(), 'data', 'exports');

const ensureExportDir = () => {
  if (!fs.existsSync(EXPORT_DIR)) {
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
  }
};

const generateId = () => Math.random().toString(36).substring(2, 11);

const generateReport = (batchIds?: string[]): ReviewReport => {
  let tracks = getTracks();
  let conflicts = getConflicts();
  const batches = getImportBatches();

  if (batchIds && batchIds.length > 0) {
    tracks = tracks.filter(t => batchIds.includes(t.importBatchId));
    const trackIds = new Set(tracks.map(t => t.id));
    conflicts = conflicts.filter(c => trackIds.has(c.trackId));
  }

  const existingTracks = getTracks().filter(t => !batchIds?.includes(t.importBatchId));
  const changes = tracks.map(track => {
    const result = detectDuplicateSubmission(track, existingTracks);
    return {
      trackId: track.trackId,
      changeType: result.status,
      changes: result.changes || {},
    };
  });

  const stats = getDashboardStats();

  return {
    id: generateId(),
    generatedAt: new Date().toISOString(),
    operator: '系统',
    batchIds: batchIds || batches.map(b => b.id),
    summary: {
      totalTracks: tracks.length,
      conflictTracks: new Set(conflicts.map(c => c.trackId)).size,
      resolvedConflicts: conflicts.filter(c => c.resolved).length,
      unresolvedConflicts: conflicts.filter(c => !c.resolved).length,
      copyrightRemoved: tracks.filter(t => t.copyrightStatus === 'removed').length,
      manualCorrections: tracks.filter(t => t.manualTags.length > 0).length,
    },
    tracks,
    conflicts,
    changes,
  };
};

const EMOTION_LABELS: Record<string, string> = {
  happy: '欢快', sad: '忧伤', energetic: '活力', calm: '平静',
  romantic: '浪漫', angry: '愤怒', nostalgic: '怀旧', hopeful: '希望',
};

const CONFLICT_LABELS: Record<string, string> = {
  algorithm_vs_manual: '算法vs人工标签',
  copyright_vs_recommend: '版权下架仍推荐',
  manual_lost: '人工修正丢失',
  version_mismatch: '版本不匹配',
};

router.post('/', (req, res) => {
  try {
    const { format = 'xlsx', batchIds } = req.body as {
      format: 'xlsx' | 'csv' | 'pdf';
      batchIds?: string[];
    };

    ensureExportDir();
    const report = generateReport(batchIds);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    let filename = '';
    let url = '';

    if (format === 'xlsx' || format === 'csv') {
      const wb = XLSX.utils.book_new();

      const summaryData = [
        ['复核报告摘要'],
        ['生成时间', new Date(report.generatedAt).toLocaleString()],
        ['操作人', report.operator],
        ['总曲目数', report.summary.totalTracks],
        ['有冲突曲目', report.summary.conflictTracks],
        ['已解决冲突', report.summary.resolvedConflicts],
        ['未解决冲突', report.summary.unresolvedConflicts],
        ['版权下架数', report.summary.copyrightRemoved],
        ['人工修正数', report.summary.manualCorrections],
      ];
      const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, summaryWs, '摘要');

      const tracksData = report.tracks.map(t => ({
        '曲目ID': t.trackId,
        '曲名': t.title,
        '歌手': t.artist,
        '专辑': t.album,
        '算法标签': t.algorithmTags.map(tag => EMOTION_LABELS[tag] || tag).join(', '),
        '人工标签': t.manualTags.map(tag => EMOTION_LABELS[tag] || tag).join(', '),
        '版权状态': t.copyrightStatus === 'removed' ? '已下架' : '正常',
        '是否推荐': t.isRecommended ? '是' : '否',
        '状态': t.status === 'active' ? '正常' : t.status === 'removed' ? '已下架' : '待处理',
        '导入批次': t.importBatchId,
      }));
      const tracksWs = XLSX.utils.json_to_sheet(tracksData);
      XLSX.utils.book_append_sheet(wb, tracksWs, '曲目列表');

      const conflictsData = report.conflicts.map(c => ({
        '冲突ID': c.id,
        '曲目ID': c.trackId,
        '冲突类型': CONFLICT_LABELS[c.conflictType] || c.conflictType,
        '严重程度': c.severity === 'high' ? '高' : c.severity === 'medium' ? '中' : '低',
        '描述': c.description,
        '状态': c.resolved ? '已解决' : '未解决',
        '解决人': c.resolver || '',
        '解决时间': c.resolvedAt ? new Date(c.resolvedAt).toLocaleString() : '',
        '解决备注': c.resolutionNote || '',
      }));
      const conflictsWs = XLSX.utils.json_to_sheet(conflictsData);
      XLSX.utils.book_append_sheet(wb, conflictsWs, '冲突列表');

      const changesData = report.changes.map(c => ({
        '曲目ID': c.trackId,
        '变更类型': c.changeType === 'new' ? '新增' : c.changeType === 'updated' ? '更新' : c.changeType === 'unchanged' ? '无变化' : '删除',
        '变更字段': Object.entries(c.changes).map(([field, val]) =>
          `${field}: ${JSON.stringify((val as any).old)} → ${JSON.stringify((val as any).new)}`
        ).join('; '),
      }));
      const changesWs = XLSX.utils.json_to_sheet(changesData);
      XLSX.utils.book_append_sheet(wb, changesWs, '变更清单');

      if (format === 'csv') {
        filename = `情绪标签复核报告_${timestamp}.csv`;
        const csvContent = XLSX.utils.sheet_to_csv(tracksWs);
        const filePath = path.join(EXPORT_DIR, filename);
        fs.writeFileSync(filePath, csvContent, 'utf-8');
        url = `/exports/${filename}`;
      } else {
        filename = `情绪标签复核报告_${timestamp}.xlsx`;
        const filePath = path.join(EXPORT_DIR, filename);
        XLSX.writeFile(wb, filePath);
        url = `/exports/${filename}`;
      }
    } else if (format === 'pdf') {
      filename = `情绪标签复核报告_${timestamp}.pdf`;
      const filePath = path.join(EXPORT_DIR, filename);

      const doc = new jsPDF();
      let yPos = 20;

      doc.setFontSize(20);
      doc.text('曲库情绪标签复核报告', 20, yPos);
      yPos += 15;

      doc.setFontSize(12);
      doc.text(`生成时间: ${new Date(report.generatedAt).toLocaleString()}`, 20, yPos);
      yPos += 10;
      doc.text(`操作人: ${report.operator}`, 20, yPos);
      yPos += 15;

      doc.setFontSize(14);
      doc.text('摘要', 20, yPos);
      yPos += 10;
      doc.setFontSize(11);
      doc.text(`总曲目数: ${report.summary.totalTracks}`, 25, yPos); yPos += 8;
      doc.text(`有冲突曲目: ${report.summary.conflictTracks}`, 25, yPos); yPos += 8;
      doc.text(`已解决冲突: ${report.summary.resolvedConflicts}`, 25, yPos); yPos += 8;
      doc.text(`未解决冲突: ${report.summary.unresolvedConflicts}`, 25, yPos); yPos += 8;
      doc.text(`版权下架数: ${report.summary.copyrightRemoved}`, 25, yPos); yPos += 8;
      doc.text(`人工修正数: ${report.summary.manualCorrections}`, 25, yPos); yPos += 15;

      doc.save(filePath);
      url = `/exports/${filename}`;
    }

    res.json({ url, filename, report });
  } catch (error) {
    console.error('Failed to export report:', error);
    res.status(500).json({ error: 'Failed to export report' });
  }
});

export default router;
