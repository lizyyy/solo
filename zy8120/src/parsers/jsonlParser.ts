import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';
import { DefectAnnotation } from '../types';

const bboxSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

const defectAnnotationSchema = z.object({
  id: z.string(),
  filename: z.string(),
  towerId: z.string(),
  defectType: z.string(),
  severity: z.enum(['critical', 'major', 'minor']),
  bbox: bboxSchema,
  confidence: z.number().min(0).max(1),
  notes: z.string().optional(),
});

export class JsonlParser {
  static parseLine(line: string): DefectAnnotation | null {
    try {
      const trimmed = line.trim();
      if (!trimmed) return null;
      
      const parsed = JSON.parse(trimmed);
      const result = defectAnnotationSchema.safeParse(parsed);
      
      if (result.success) {
        return result.data;
      }
      return null;
    } catch {
      return null;
    }
  }

  static parseDefects(filePath: string): DefectAnnotation[] {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split(/\r?\n/);
    
    const annotations: DefectAnnotation[] = [];
    
    for (const line of lines) {
      const annotation = this.parseLine(line);
      if (annotation) {
        annotations.push(annotation);
      }
    }
    
    return annotations;
  }

  static parseDefectsFromDir(inputDir: string): DefectAnnotation[] {
    const jsonlPath = path.join(inputDir, 'defects.jsonl');
    if (!fs.existsSync(jsonlPath)) {
      console.warn(`找不到缺陷标注文件: ${jsonlPath}，跳过缺陷检查`);
      return [];
    }
    return this.parseDefects(jsonlPath);
  }

  static validateBbox(
    bbox: { x: number; y: number; width: number; height: number },
    imageWidth: number,
    imageHeight: number
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (bbox.width <= 0 || bbox.height <= 0) {
      errors.push(`bbox 尺寸无效: width=${bbox.width}, height=${bbox.height}`);
    }
    
    if (bbox.x < 0 || bbox.y < 0) {
      errors.push(`bbox 坐标不能为负: x=${bbox.x}, y=${bbox.y}`);
    }
    
    if (bbox.x + bbox.width > imageWidth) {
      errors.push(`bbox 超出图像右边界: x+width=${bbox.x + bbox.width} > imageWidth=${imageWidth}`);
    }
    
    if (bbox.y + bbox.height > imageHeight) {
      errors.push(`bbox 超出图像下边界: y+height=${bbox.y + bbox.height} > imageHeight=${imageHeight}`);
    }
    
    return { valid: errors.length === 0, errors };
  }
}
