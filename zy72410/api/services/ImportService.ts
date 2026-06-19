import type { Material, ImportPreviewResult, ImportPreviewItem, ImportConfirmRequest, MaterialStatus } from '../../shared/types.js';
import { MaterialRepository } from '../repositories/MaterialRepository.js';
import { TrackRepository } from '../repositories/TrackRepository.js';
import { ChangeRepository } from '../repositories/ChangeRepository.js';
import { detectDuplicate, detectReworkReason } from '../utils/detector.js';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

export class ImportService {
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

  parseFile(fileBuffer: Buffer, file_name: string): Array<Omit<Material, 'id' | 'status' | 'batch_id' | 'created_at' | 'updated_at'>> {
    const ext = file_name.split('.').pop()?.toLowerCase();
    let data: any[] = [];

    if (ext === 'xlsx' || ext === 'xls') {
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      data = XLSX.utils.sheet_to_json(firstSheet);
    } else if (ext === 'csv') {
      const content = fileBuffer.toString('utf-8');
      const result = Papa.parse(content, { header: true });
      data = result.data as any[];
    } else {
      throw new Error('Unsupported file format');
    }

    return data.map(row => this.mapRowToMaterial(row));
  }

  previewImport(
    materials: Array<Omit<Material, 'id' | 'status' | 'batch_id' | 'created_at' | 'updated_at'> & { track_name?: string; track_number?: number }>,
    file_name: string,
    imported_by: string
  ): ImportPreviewResult {
    const batch = this.materialRepo.createImportBatch(file_name, imported_by);
    const existing = this.materialRepo.findAllForDuplicateCheck();

    const reused_items: ImportPreviewItem[] = [];
    const new_items: ImportPreviewItem[] = [];
    const suspected_duplicates: ImportPreviewItem[] = [];
    let tempIdCounter = 0;

    for (const mat of materials) {
      const match = detectDuplicate(
        { material_name: mat.material_name, isrc_code: mat.isrc_code, license_start_date: mat.license_start_date },
        existing
      );

      const temp_id = `temp-${++tempIdCounter}`;
      const previewItem: ImportPreviewItem = {
        temp_id,
        material_name: mat.material_name,
        isrc_code: mat.isrc_code,
        composer: mat.composer,
        project_name: mat.project_name,
        license_start_date: mat.license_start_date,
        license_end_date: mat.license_end_date,
        episode_count: mat.episode_count,
        license_fee: mat.license_fee,
        revenue_ratio: mat.revenue_ratio,
        error_tolerance: mat.error_tolerance,
        match_status: match.is_duplicate ? 'reused' : (match.match_score >= 2 ? 'duplicate' : 'new'),
        match_dimensions: match.matched_fields,
        existing_id: match.existing_material_id,
        track_name: (mat as any).track_name || '',
        track_number: (mat as any).track_number || 1
      };

      if (match.is_duplicate && match.existing_material_id) {
        reused_items.push(previewItem);
      } else if (match.match_score >= 2 && match.existing_material_id) {
        suspected_duplicates.push(previewItem);
      } else {
        new_items.push(previewItem);
      }
    }

    this.materialRepo.updateImportBatchCounts(
      batch.id,
      materials.length,
      reused_items.length,
      new_items.length,
      suspected_duplicates.length
    );

    return {
      batch_id: batch.id,
      file_name,
      new_items,
      reused_items,
      suspected_duplicates,
      imported_by,
      created_at: new Date().toISOString()
    };
  }

  confirmImport(request: ImportConfirmRequest, operator: string): { materials: Material[]; tracks: any[]; stats: { new_count: number; reused_count: number; reused_material_ids: string[] } {
    const createdMaterials: Material[] = [];
    const createdTracks: any[] = [];
    let new_count = 0;
    let reused_count = 0;
    const reused_material_ids: string[] = [];

    for (const item of request.items) {
      const hasTrackRework = item.tracks.some(t => detectReworkReason(t.remarks || ''));
      const hasMaterialRework = detectReworkReason(item.material.error_tolerance || '');
      const hasRework = hasTrackRework || hasMaterialRework;
      const status: MaterialStatus = hasRework ? 'rework_pending' : 'normal';

      const existingMatch = this.materialRepo.findByIsrcAndDate(
        item.material.material_name,
        item.material.isrc_code,
        item.material.license_start_date
      );
      if (existingMatch) {
        reused_count++;
        reused_material_ids.push(existingMatch.id);

        const reuseChange = this.changeRepo.create({
          material_id: existingMatch.id,
          track_id: '',
          field_name: 'import_reuse',
          old_value: 'existing',
          new_value: 'reused',
          operator,
          change_reason: '授权期限页重复导入，复用已存在素材，不重复创建',
          affected_items: [existingMatch.id]
        });

        this.changeRepo.createHistoryRecord({
          material_id: existingMatch.id,
          track_id: '',
          field_name: 'import_reuse',
          old_value: 'existing',
          new_value: 'reused',
          operator,
          change_reason: '授权期限页重复导入，复用已存在素材，不重复创建',
          record_snapshot: existingMatch as unknown as Record<string, unknown>,
          change_id: reuseChange.id
        });

        continue;
      }

      const material = this.materialRepo.create({
        ...item.material,
        status,
        batch_id: request.batch_id
      });
      createdMaterials.push(material);
      new_count++;

      const initialChange = this.changeRepo.create({
        material_id: material.id,
        track_id: '',
        field_name: 'import',
        old_value: 'none',
        new_value: 'created',
        operator,
        change_reason: '授权期限页第一次导入，创建素材记录',
        affected_items: [material.id]
      });

      this.changeRepo.createHistoryRecord({
        material_id: material.id,
        track_id: '',
        field_name: 'import',
        old_value: 'none',
        new_value: 'created',
        operator,
        change_reason: '授权期限页第一次导入，创建素材记录',
        record_snapshot: material as unknown as Record<string, unknown>,
        change_id: initialChange.id
      });

      if (item.tracks && item.tracks.length > 0) {
        for (const trackData of item.tracks) {
          if (!trackData.track_name && !trackData.track_number) continue;
          const track = this.trackRepo.create({
            ...trackData,
            material_id: material.id,
            need_recheck: detectReworkReason(trackData.remarks || ''),
            rework_confirmed: false,
            rework_confirmed_by: '',
            rework_confirmed_at: ''
          });
          createdTracks.push(track);

          const trackChange = this.changeRepo.create({
            material_id: material.id,
            track_id: track.id,
            field_name: 'track_import',
            old_value: 'none',
            new_value: track.track_name,
            operator,
            change_reason: '导入时创建轨道记录',
            affected_items: [material.id, track.id]
          });

          this.changeRepo.createHistoryRecord({
            material_id: material.id,
            track_id: track.id,
            field_name: 'track_import',
            old_value: 'none',
            new_value: track.track_name,
            operator,
            change_reason: '导入时创建轨道记录',
            record_snapshot: track as unknown as Record<string, unknown>,
            change_id: trackChange.id
          });
        }
      }

      const tracks = this.trackRepo.findByMaterialId(material.id);
      const allChecked = tracks.every(t => !t.need_recheck || t.rework_confirmed);
      if (allChecked && material.status === 'normal') {
        this.materialRepo.updateStatus(material.id, 'completed');
      }
    }

    return {
      materials: createdMaterials,
      tracks: createdTracks,
      stats: { new_count, reused_count, reused_material_ids }
    };
  }

  private mapRowToMaterial(row: any): Omit<Material, 'id' | 'status' | 'batch_id' | 'created_at' | 'updated_at'> & { track_name?: string; track_number?: number } {
    const getValue = (keys: string[]): string => {
      for (const key of keys) {
        if (row[key] !== undefined && row[key] !== null) {
          return String(row[key]).trim();
        }
      }
      return '';
    };

    const getNumberValue = (keys: string[], defaultValue: number = 0): number => {
      const val = getValue(keys);
      const num = parseFloat(val);
      return isNaN(num) ? defaultValue : num;
    };

    const parseDate = (dateStr: string): string => {
      if (!dateStr) return '';
      const cleaned = dateStr.replace(/年|月/g, '-').replace(/日/g, '');
      const date = new Date(cleaned);
      if (isNaN(date.getTime())) return dateStr;
      return date.toISOString().split('T')[0];
    };

    const royaltyRate = (() => {
      const val = getValue(['分成比例', '分成', 'royaltyRate', 'revenue_ratio']);
      if (!val) return '0';
      const num = parseFloat(val.replace(/%/g, ''));
      return String(num > 1 ? num / 100 : num);
    })();

    return {
      material_name: getValue(['素材名称', '名称', 'name', 'materialName', 'material_name']),
      isrc_code: getValue(['ISRC', 'isrc', '编码', 'ISRC编码', 'isrc_code']),
      composer: getValue(['作曲', '作曲家', 'composer']),
      project_name: getValue(['项目名称', '影视剧名称', '剧目', '作品名称', 'dramaName', 'projectName', 'project_name']),
      license_start_date: parseDate(getValue(['授权起始', '授权起始日期', '开始日期', '起始日期', 'authorizationStart', 'licenseStartDate', 'license_start_date'])),
      license_end_date: parseDate(getValue(['授权结束', '授权截止日期', '结束日期', '截止日期', 'authorizationEnd', 'licenseEndDate', 'license_end_date'])),
      episode_count: getNumberValue(['集数', 'episodes', 'episodeCount', 'episode_count'], 0),
      license_fee: getNumberValue(['授权费用(万元)', '保底费用', '保底', '金额', 'baseFee', 'licenseFee', 'license_fee'], 0),
      revenue_ratio: royaltyRate,
      error_tolerance: getValue(['误差说明', '误差容限', '容差', 'errorTolerance', 'error_tolerance']),
      track_name: getValue(['轨道名称', 'trackName', 'track_name']),
      track_number: getNumberValue(['轨道编号', 'trackNumber', 'track_number'], 1)
    };
  }
}
