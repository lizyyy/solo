import type { Material, Track, ReportSummary, ChangeTraceNode } from '../../shared/types.js';
import { MaterialRepository } from '../repositories/MaterialRepository.js';
import { TrackRepository } from '../repositories/TrackRepository.js';
import { ChangeRepository } from '../repositories/ChangeRepository.js';
import { SyncService } from './SyncService.js';
import { SelfCheckService } from './SelfCheckService.js';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';

export class ExportService {
  private materialRepo: MaterialRepository;
  private trackRepo: TrackRepository;
  private changeRepo: ChangeRepository;
  private syncService: SyncService;
  private selfCheckService: SelfCheckService;

  constructor(
    materialRepo: MaterialRepository,
    trackRepo: TrackRepository,
    changeRepo: ChangeRepository,
    syncService: SyncService,
    selfCheckService: SelfCheckService
  ) {
    this.materialRepo = materialRepo;
    this.trackRepo = trackRepo;
    this.changeRepo = changeRepo;
    this.syncService = syncService;
    this.selfCheckService = selfCheckService;
  }

  getReportSummary(): ReportSummary {
    const counts = this.materialRepo.countByStatus();
    const selfCheckResults = this.selfCheckService.runAllChecks();
    const batches = this.materialRepo.findAllBatches();
    const total_materials = counts.pending + counts.normal + counts.conflict + counts.rework_pending + counts.completed;
    const total_tracks = this.trackRepo.count();
    const tracks_need_recheck = this.trackRepo.countNeedRecheck();
    const material_change_counts: Record<string, number> = {};

    const allChanges = this.changeRepo.findAll();
    for (const change of allChanges) {
      const name = (change as any).material_name || change.material_id;
      material_change_counts[name] = (material_change_counts[name] || 0) + 1;
    }

    return {
      total_materials,
      total_tracks,
      pending_conflicts: counts.conflict,
      tracks_need_recheck,
      total_changes: this.changeRepo.count(),
      total_new_imports: counts.pending + counts.normal + counts.conflict + counts.rework_pending,
      total_reused_imports: 0,
      import_batches: batches.map(b => ({
        batch_id: b.batch_id,
        file_name: b.file_name,
        new_count: b.new_count,
        reused_count: b.reused_count,
        total_count: b.total_count,
        imported_by: b.imported_by,
        created_at: b.created_at
      })),
      material_change_counts,
      generated_at: new Date().toISOString()
    };
  }

  getChangeTrace(materialId: string): ChangeTraceNode[] {
    return this.syncService.getChangeTrace(materialId);
  }

  exportExcel(): Buffer {
    const materials = this.materialRepo.findAll();
    const allTracks: Array<Track & { material_name: string; material_isrc: string }> = [];

    for (const mat of materials) {
      const tracks = this.trackRepo.findByMaterialId(mat.id);
      for (const track of tracks) {
        allTracks.push({
          ...track,
          material_name: mat.material_name,
          material_isrc: mat.isrc_code
        });
      }
    }

    const changes = this.changeRepo.findAll();

    const materialData = materials.map(m => ({
      素材ID: m.id,
      素材名称: m.material_name,
      ISRC编码: m.isrc_code,
      作曲: m.composer,
      授权起始日期: m.license_start_date,
      授权结束日期: m.license_end_date,
      影视剧名称: m.project_name,
      集数: m.episode_count,
      保底费用_元: m.license_fee,
      分成比例: `${(parseFloat(m.revenue_ratio) * 100).toFixed(1)}%`,
      误差容限: m.error_tolerance,
      状态: this.getStatusLabel(m.status),
      导入批次: m.batch_id,
      创建时间: m.created_at,
      更新时间: m.updated_at
    }));

    const trackData = allTracks.map(t => ({
      轨道ID: t.id,
      素材名称: t.material_name,
      ISRC编码: t.material_isrc,
      轨道名称: t.track_name,
      轨道序号: t.track_number,
      轨道类型: t.track_type,
      轨道ISRC: t.isrc_code,
      轨道备注: t.remarks,
      需复核: t.need_recheck ? '是' : '否',
      返工已复核: t.rework_confirmed ? '是' : '否',
      复核人: t.rework_confirmed_by,
      复核时间: t.rework_confirmed_at
    }));

    const changeData = changes.map(c => ({
      变更ID: c.id,
      素材ID: c.material_id,
      轨道ID: c.track_id,
      变更字段: c.field_name,
      原值: c.old_value,
      新值: c.new_value,
      操作人: c.operator,
      变更原因: c.change_reason,
      影响记录: c.affected_items.join(', '),
      变更时间: c.created_at
    }));

    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(materialData);
    const ws2 = XLSX.utils.json_to_sheet(trackData);
    const ws3 = XLSX.utils.json_to_sheet(changeData);

    XLSX.utils.book_append_sheet(wb, ws1, '素材清单');
    XLSX.utils.book_append_sheet(wb, ws2, '轨道明细');
    XLSX.utils.book_append_sheet(wb, ws3, '变更记录');

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  exportPDF(): Buffer {
    const summary = this.getReportSummary();
    const materials = this.materialRepo.findAll();
    const selfCheck = this.selfCheckService.runAllChecks();

    const doc = new jsPDF();
    let yPos = 20;

    doc.setFontSize(18);
    doc.text('影视配乐素材入库报告', 105, yPos, { align: 'center' });
    yPos += 15;

    doc.setFontSize(12);
    doc.text(`生成时间: ${new Date().toLocaleString('zh-CN')}`, 14, yPos);
    yPos += 10;

    doc.setFillColor(212, 175, 55);
    doc.rect(14, yPos, 182, 60, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.text('入库汇总', 16, yPos + 8);

    doc.setFontSize(11);
    const selfCheckPassed = selfCheck.every(r => r.passed);
    const items = [
      ['素材总数', String(summary.total_materials)],
      ['新增素材', String(summary.total_new_imports)],
      ['待处理冲突', String(summary.pending_conflicts)],
      ['待复核返工', String(summary.tracks_need_recheck)],
      ['已完成', String(0)],
      ['变更记录数', String(summary.total_changes)],
      ['自检通过', selfCheckPassed ? '是' : '否']
    ];

    for (let i = 0; i < items.length; i++) {
      const col = i % 3;
      const row = Math.floor(i / 3);
      doc.text(items[i][0], 20 + col * 60, yPos + 25 + row * 15);
      doc.text(items[i][1], 20 + col * 60, yPos + 33 + row * 15);
    }

    yPos += 75;
    doc.setTextColor(0, 0, 0);

    doc.setFontSize(14);
    doc.text('自检结果', 14, yPos);
    yPos += 8;

    for (const check of selfCheck) {
      const status = check.passed ? '通过' : '未通过';
      const statusColor = check.passed ? [16, 185, 129] : [230, 57, 70];
      doc.setFillColor(...statusColor as [number, number, number]);
      doc.circle(18, yPos - 2, 2, 'F');
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(11);
      doc.text(`${this.getCheckTypeLabel(check.check_type)}: ${status}`, 24, yPos);
      yPos += 6;

      if (check.details.length > 0) {
        doc.setTextColor(100, 100, 100);
        doc.setFontSize(9);
        for (const issue of check.details.slice(0, 2)) {
          doc.text(`  - ${issue.description}`, 24, yPos);
          yPos += 5;
        }
        if (check.details.length > 2) {
          doc.text(`  ... 还有${check.details.length - 2}项问题`, 24, yPos);
          yPos += 5;
        }
        doc.setTextColor(0, 0, 0);
      }
      yPos += 2;
    }

    yPos += 10;
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(14);
    doc.text('素材清单 (前10条)', 14, yPos);
    yPos += 8;

    doc.setFontSize(9);
    doc.setFillColor(240, 240, 240);
    doc.rect(14, yPos, 182, 7, 'F');
    doc.text('名称', 16, yPos + 5);
    doc.text('ISRC', 60, yPos + 5);
    doc.text('影视剧', 100, yPos + 5);
    doc.text('状态', 160, yPos + 5);
    yPos += 10;

    for (let i = 0; i < Math.min(10, materials.length); i++) {
      const mat = materials[i];
      doc.text(mat.material_name.substring(0, 20), 16, yPos);
      doc.text(mat.isrc_code, 60, yPos);
      doc.text(mat.project_name.substring(0, 15), 100, yPos);
      doc.text(this.getStatusLabel(mat.status), 160, yPos);
      yPos += 6;
    }

    return Buffer.from(doc.output('arraybuffer'));
  }

  private getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      pending: '待处理',
      normal: '正常',
      conflict: '冲突待处理',
      rework_pending: '返工待复核',
      completed: '已完成'
    };
    return labels[status] || status;
  }

  private getCheckTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      duplicate: '重复导入检测',
      rework: '返工原因检测',
      recalculate: '补录重算检测',
      export: '导出一致性检测'
    };
    return labels[type] || type;
  }
}
