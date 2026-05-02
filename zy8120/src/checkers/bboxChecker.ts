import { DefectAnnotation, ManifestEntry, ImageExif, Issue } from '../types';
import { JsonlParser } from '../parsers';
import { randomUUID } from 'crypto';

export class BboxChecker {
  static checkBboxOutOfBounds(
    defects: DefectAnnotation[],
    manifest: ManifestEntry[],
    exifMap: Map<string, ImageExif>
  ): { issues: Issue[]; invalidBboxes: string[] } {
    const issues: Issue[] = [];
    const invalidBboxes: string[] = [];
    
    const imageDimensions = this.buildImageDimensionMap(manifest, exifMap);
    
    for (const defect of defects) {
      const dimensions = imageDimensions.get(defect.filename);
      
      if (!dimensions) {
        invalidBboxes.push(defect.id);
        issues.push({
          id: randomUUID(),
          category: 'bbox_out_of_bounds',
          severity: 'major',
          message: `缺陷标注 ${defect.id} 引用的图片 ${defect.filename} 不存在或无尺寸信息`,
          details: {
            defectId: defect.id,
            filename: defect.filename,
            defectType: defect.defectType,
            towerId: defect.towerId,
          },
          relatedFiles: [defect.filename],
          timestamp: new Date().toISOString(),
        });
        continue;
      }
      
      const validation = JsonlParser.validateBbox(
        defect.bbox,
        dimensions.width,
        dimensions.height
      );
      
      if (!validation.valid) {
        invalidBboxes.push(defect.id);
        issues.push({
          id: randomUUID(),
          category: 'bbox_out_of_bounds',
          severity: 'major',
          message: `缺陷标注 ${defect.id} 的 bbox 越界: ${validation.errors.join(', ')}`,
          details: {
            defectId: defect.id,
            filename: defect.filename,
            defectType: defect.defectType,
            bbox: defect.bbox,
            imageWidth: dimensions.width,
            imageHeight: dimensions.height,
            errors: validation.errors,
          },
          relatedFiles: [defect.filename],
          timestamp: new Date().toISOString(),
        });
      }
    }
    
    return { issues, invalidBboxes };
  }

  static checkDuplicateDefects(
    defects: DefectAnnotation[]
  ): Issue[] {
    const issues: Issue[] = [];
    const seen = new Map<string, DefectAnnotation[]>();
    
    for (const defect of defects) {
      const key = `${defect.filename}-${defect.defectType}-${defect.bbox.x}-${defect.bbox.y}`;
      const existing = seen.get(key) || [];
      existing.push(defect);
      seen.set(key, existing);
    }
    
    for (const [key, duplicates] of seen.entries()) {
      if (duplicates.length > 1) {
        issues.push({
          id: randomUUID(),
          category: 'bbox_out_of_bounds',
          severity: 'minor',
          message: `检测到 ${duplicates.length} 个可能重复的缺陷标注`,
          details: {
            key,
            count: duplicates.length,
            defectIds: duplicates.map(d => d.id),
            filenames: duplicates.map(d => d.filename),
          },
          relatedFiles: duplicates.map(d => d.filename),
          timestamp: new Date().toISOString(),
        });
      }
    }
    
    return issues;
  }

  private static buildImageDimensionMap(
    manifest: ManifestEntry[],
    exifMap: Map<string, ImageExif>
  ): Map<string, { width: number; height: number }> {
    const map = new Map<string, { width: number; height: number }>();
    
    for (const entry of manifest) {
      if (entry.imageWidth > 0 && entry.imageHeight > 0) {
        map.set(entry.filename, {
          width: entry.imageWidth,
          height: entry.imageHeight,
        });
      }
    }
    
    for (const [filename, exif] of exifMap.entries()) {
      if (exif.imageWidth && exif.imageHeight) {
        map.set(filename, {
          width: exif.imageWidth,
          height: exif.imageHeight,
        });
      }
    }
    
    return map;
  }
}
