import * as crypto from 'crypto';
import { ConsistencyMap, FieldType } from '../types';

export interface MappingResult {
  masked: string;
  isNew: boolean;
}

export class ConsistencyManager {
  private maps: ConsistencyMap;
  private salt: string;
  private counters: Map<FieldType, number>;
  private mappingStats: Map<FieldType, Map<string, { count: number; files: Set<string> }>>;

  constructor(salt: string) {
    this.salt = salt;
    this.maps = {};
    this.counters = new Map();
    this.mappingStats = new Map();
  }

  getOrCreate(
    original: string,
    type: FieldType,
    generator: (original: string, type: FieldType, salt: string, counter: number) => string,
    fileName?: string
  ): MappingResult {
    if (!original || typeof original !== 'string') {
      return { masked: original, isNew: false };
    }

    const trimmed = original.trim();
    if (trimmed === '') {
      return { masked: original, isNew: false };
    }

    if (!this.maps[type]) {
      this.maps[type] = {};
    }

    if (!this.mappingStats.has(type)) {
      this.mappingStats.set(type, new Map());
    }

    const existing = this.maps[type][trimmed];
    
    if (existing !== undefined) {
      const stats = this.mappingStats.get(type)!.get(trimmed);
      if (stats) {
        stats.count++;
        if (fileName) {
          stats.files.add(fileName);
        }
      }
      return { masked: existing, isNew: false };
    }

    const counter = this.counters.get(type) || 0;
    const masked = generator(trimmed, type, this.salt, counter);
    
    this.maps[type][trimmed] = masked;
    this.counters.set(type, counter + 1);
    
    const statsMap = this.mappingStats.get(type)!;
    const files = new Set<string>();
    if (fileName) {
      files.add(fileName);
    }
    statsMap.set(trimmed, { count: 1, files });

    return { masked, isNew: true };
  }

  getMap(type: FieldType): { [original: string]: string } {
    return this.maps[type] || {};
  }

  getAllMaps(): ConsistencyMap {
    return { ...this.maps };
  }

  getStats(): {
    [type: string]: {
      totalUnique: number;
      totalOccurrences: number;
      mappings: { original: string; masked: string; count: number; files: string[] }[];
    };
  } {
    const result: any = {};

    for (const [type, statsMap] of this.mappingStats.entries()) {
      const typeMap = this.maps[type] || {};
      const mappings: any[] = [];
      let totalOccurrences = 0;

      for (const [original, stats] of statsMap.entries()) {
        const masked = typeMap[original];
        totalOccurrences += stats.count;
        mappings.push({
          original,
          masked,
          count: stats.count,
          files: Array.from(stats.files),
        });
      }

      result[type] = {
        totalUnique: mappings.length,
        totalOccurrences,
        mappings,
      };
    }

    return result;
  }

  static hashWithSalt(value: string, salt: string): string {
    return crypto
      .createHash('sha256')
      .update(`${salt}:${value}`)
      .digest('hex');
  }

  static shortHash(value: string, salt: string, length: number = 8): string {
    return this.hashWithSalt(value, salt).substring(0, length);
  }

  loadExistingMaps(maps: ConsistencyMap): void {
    for (const [type, typeMap] of Object.entries(maps)) {
      if (!this.maps[type]) {
        this.maps[type] = {};
      }
      Object.assign(this.maps[type], typeMap);
      
      if (!this.mappingStats.has(type as FieldType)) {
        this.mappingStats.set(type as FieldType, new Map());
      }
      const statsMap = this.mappingStats.get(type as FieldType)!;
      
      for (const [original, masked] of Object.entries(typeMap)) {
        if (!statsMap.has(original)) {
          statsMap.set(original, { count: 0, files: new Set() });
        }
      }
      
      const maxCounter = Object.keys(typeMap).length;
      const currentCounter = this.counters.get(type as FieldType) || 0;
      this.counters.set(type as FieldType, Math.max(currentCounter, maxCounter));
    }
  }
}
