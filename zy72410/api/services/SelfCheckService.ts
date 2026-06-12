import type { SelfCheckResult, SelfCheckIssueDetail, SelfCheckType, Material } from '../../shared/types.js';
import { MaterialRepository } from '../repositories/MaterialRepository.js';
import { TrackRepository } from '../repositories/TrackRepository.js';
import { ChangeRepository } from '../repositories/ChangeRepository.js';
import { detectReworkReason } from '../utils/detector.js';
import * as XLSX from 'xlsx';

export class SelfCheckService {
  private materialRepo: MaterialRepository;
  private trackRepo: TrackRepository;
  private changeRepo: ChangeRepository;

  constructor(
    materialRepo: MaterialRepository,
    trackRepo: TrackRepository,
    changeRepo: ChangeRepository
  ) {
    this.materialRepo = materialRepo;
    this.trackRepo = trackRepo;
    this.changeRepo = changeRepo;
  }

  runAllChecks(): SelfCheckResult[] {
    return [
      this.checkDuplicateImport(),
      this.checkReworkReasons(),
      this.checkRecalculate(),
      this.checkExportConsistency()
    ];
  }

  checkDuplicateImport(): SelfCheckResult {
    const details: SelfCheckIssueDetail[] = [];
    const allMaterials = this.materialRepo.findAll();
    const seenKeys = new Map<string, string[]>();

    for (const mat of allMaterials) {
      const key = `${mat.material_name}|${mat.isrc_code}|${mat.license_start_date}`;
      if (!seenKeys.has(key)) {
        seenKeys.set(key, []);
      }
      seenKeys.get(key)!.push(mat.id);
    }

    for (const [key, ids] of seenKeys) {
      if (ids.length > 1) {
        details.push({
          id: `dup-${key}`,
          description: `检测到重复导入记录：${key.split('|')[0]}，共${ids.length}条记录`,
          location: `导入批次: ${ids.map(id => {
            const m = allMaterials.find(mm => mm.id === id);
            return m?.batch_id || 'unknown';
          }).join(', ')}`
        });
      }
    }

    return {
      check_type: 'duplicate',
      passed: details.length === 0,
      issue_count: details.length,
      details,
      checked_at: new Date().toISOString()
    };
  }

  checkReworkReasons(): SelfCheckResult {
    const details: SelfCheckIssueDetail[] = [];
    const pendingRework = this.trackRepo.findAllWithReworkPending();

    for (const track of pendingRework) {
      details.push({
        id: `rework-${track.id}`,
        description: `轨道备注含返工原因待复核：${track.track_name} - ${track.remarks}`,
        location: `素材: ${(track as any).material_name}, 轨道: ${track.track_name}`
      });
    }

    const allTracks = this.trackRepo.findAllWithReworkPending();
    const allMaterials = this.materialRepo.findAll();
    for (const mat of allMaterials) {
      const tracks = this.trackRepo.findByMaterialId(mat.id);
      for (const track of tracks) {
        if (track.remarks && detectReworkReason(track.remarks) && !track.need_recheck) {
          details.push({
            id: `rework-miss-${track.id}`,
            description: `轨道备注含返工关键词但系统未标记：${track.remarks}`,
            location: `轨道: ${track.track_name}`
          });
        }
      }
    }

    return {
      check_type: 'rework',
      passed: details.length === 0,
      issue_count: details.length,
      details,
      checked_at: new Date().toISOString()
    };
  }

  checkRecalculate(): SelfCheckResult {
    const details: SelfCheckIssueDetail[] = [];
    const allChanges = this.changeRepo.findAll();
    const materials = this.materialRepo.findAll();

    for (const mat of materials) {
      const matChanges = allChanges.filter(c => c.material_id === mat.id);
      const hasRecalc = matChanges.some(c => c.field_name === 'recalculation');
      const hasMessage = matChanges.some(c => c.change_reason.includes('调音师留言'));

      if (hasMessage && !hasRecalc) {
        details.push({
          id: `recalc-${mat.id}`,
          description: `素材"${mat.material_name}"补录留言后未执行重算`,
          location: `素材ID: ${mat.id}`
        });
      }

      for (const change of matChanges) {
        if (change.field_name !== 'import' && change.field_name !== 'track_import' && change.field_name !== 'recalculation') {
          const hasHistory = this.changeRepo.findHistoryByMaterialId(mat.id)
            .some(h => h.change_id === change.id);
          if (!hasHistory) {
            details.push({
              id: `recalc-history-${change.id}`,
              description: `变更"${change.field_name}"未同步到历史记录`,
              location: `变更ID: ${change.id}`
            });
          }
        }
      }
    }

    return {
      check_type: 'recalculate',
      passed: details.length === 0,
      issue_count: details.length,
      details,
      checked_at: new Date().toISOString()
    };
  }

  checkExportConsistency(): SelfCheckResult {
    const details: SelfCheckIssueDetail[] = [];
    const materials = this.materialRepo.findAll();

    try {
      const exportData = materials.map(m => ({
        素材名称: m.material_name,
        ISRC: m.isrc_code,
        授权起始: m.license_start_date,
        授权结束: m.license_end_date,
        影视剧: m.project_name,
        集数: m.episode_count,
        保底费用: m.license_fee,
        分成比例: `${(parseFloat(m.revenue_ratio) * 100).toFixed(1)}%`,
        状态: m.status
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const exportedRows = XLSX.utils.sheet_to_json(ws);

      if (exportedRows.length !== materials.length) {
        details.push({
          id: 'export-count',
          description: `导出数据行数不一致：系统${materials.length}条，导出${exportedRows.length}条`,
          location: '导出功能'
        });
      }

      for (let i = 0; i < Math.min(materials.length, exportedRows.length); i++) {
        const sys = materials[i];
        const exp = exportedRows[i] as any;
        if (sys.material_name !== exp['素材名称'] || sys.isrc_code !== exp['ISRC']) {
          details.push({
            id: `export-mismatch-${i}`,
            description: `第${i + 1}行导出数据与系统不一致`,
            location: `导出行: ${i + 1}`
          });
        }
      }
    } catch (e: any) {
      details.push({
        id: 'export-error',
        description: `导出测试失败: ${e.message}`,
        location: '导出功能'
      });
    }

    return {
      check_type: 'export',
      passed: details.length === 0,
      issue_count: details.length,
      details,
      checked_at: new Date().toISOString()
    };
  }
}
