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
    materials: Array<Omit<Material, 'id' | 'status' | 'batch_id' | 'created_at' | 'updated_at'>>,
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
        license_start_date: mat.license_start_date,
        license_end_date: mat.license_end_date,
        episode_count: mat.episode_count,
        license_fee: mat.license_fee,
        revenue_ratio: mat.revenue_ratio,
        match_status: match.is_duplicate ? 'reused' : (match.match_score >= 2 ? 'duplicate' : 'new'),
        match_dimensions: match.matched_fields,
        existing_id: match.existing_material_id
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

  confirmImport(request: ImportConfirmRequest, operator: string): { materials: Material[]; tracks: any[] } {
    const createdMaterials: Material[] = [];
    const createdTracks: any[] = [];

    for (const item of request.items) {
      const hasReworkInTracks = item.tracks.some(t => detectReworkReason(t.remarks || ''));
      const status: MaterialStatus = hasReworkInTracks ? 'rework_pending' : 'normal';

      const material = this.materialRepo.create({
        ...item.material,
        status,
        batch_id: request.batch_id
      });
      createdMaterials.push(material);

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

      for (const trackData of item.tracks) {
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

      const tracks = this.trackRepo.findByMaterialId(material.id);
      const allChecked = tracks.every(t => !t.need_recheck || t.rework_confirmed);
      if (allChecked && material.status === 'normal') {
        this.materialRepo.updateStatus(material.id, 'completed');
      }
    }

    return { materials: createdMaterials, tracks: createdTracks };
  }

  private mapRowToMaterial(row: any): Omit<Material, 'id' | 'status' | 'batch_id' | 'created_at' | 'updated_at'> {
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
      const val = getValue(['分成比例', '分成', 'royaltyRate']);
      if (!val) return '0';
      const num = parseFloat(val.replace(/%/g, ''));
      return String(num > 1 ? num / 100 : num);
    })();

    return {
      material_name: getValue(['素材名称', '名称', 'name', 'materialName']),
      isrc_code: getValue(['ISRC', 'isrc', '编码', 'ISRC编码']),
      composer: getValue(['作曲', '作曲家', 'composer']),
      project_name: getValue(['影视剧名称', '剧目', '作品名称', 'dramaName', 'projectName']),
      license_start_date: parseDate(getValue(['授权起始', '开始日期', '起始日期', 'authorizationStart', 'licenseStartDate'])),
      license_end_date: parseDate(getValue(['授权结束', '结束日期', '截止日期', 'authorizationEnd', 'licenseEndDate'])),
      episode_count: getNumberValue(['集数', 'episodes', 'episodeCount'], 0),
      license_fee: getNumberValue(['保底费用', '保底', '金额', 'baseFee', 'licenseFee'], 0),
      revenue_ratio: royaltyRate,
      error_tolerance: getValue(['误差容限', '容差', 'errorTolerance'])
    };
  }
}
