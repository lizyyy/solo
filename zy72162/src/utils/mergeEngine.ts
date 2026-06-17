import { GarbagePoint, SourceData, MergeConfig, MergeCandidate, ConflictInfo, PointStatus, SourceType, DEFAULT_MERGE_CONFIG } from '@/types';
import { calculateNameSimilarity } from './stringUtils';
import { haversineDistance } from './geoUtils';
import { generateShortId } from './stringUtils';

export class MergeEngine {
  private config: MergeConfig;

  constructor(config: MergeConfig = DEFAULT_MERGE_CONFIG) {
    this.config = config;
  }

  updateConfig(config: Partial<MergeConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): MergeConfig {
    return { ...this.config };
  }

  findMergeCandidates(
    sourceData: SourceData,
    existingPoints: GarbagePoint[]
  ): MergeCandidate[] {
    const candidates: MergeCandidate[] = [];
    const sourceLat = sourceData.rawData.lat ?? sourceData.rawData.exifLat;
    const sourceLng = sourceData.rawData.lng ?? sourceData.rawData.exifLng;

    for (const point of existingPoints) {
      const nameSimilarity = calculateNameSimilarity(sourceData.sourceName, point.canonicalName);
      
      let distance = Infinity;
      if (sourceLat !== undefined && sourceLng !== undefined) {
        distance = haversineDistance(sourceLat, sourceLng, point.lat, point.lng);
      }

      if (distance > 200) {
        continue;
      }

      let confidence = 0;
      let reason = '';

      if (nameSimilarity >= this.config.nameSimilarityThreshold) {
        if (distance <= this.config.distanceThreshold) {
          confidence = 0.7 * nameSimilarity + 0.3 * (1 - Math.min(distance / 200, 1));
          reason = `名称相似度 ${(nameSimilarity * 100).toFixed(0)}%，距离 ${Math.round(distance)}米`;
        } else if (distance <= 100) {
          confidence = 0.8 * nameSimilarity + 0.2 * (1 - Math.min(distance / 200, 1));
          reason = `名称相似度较高 ${(nameSimilarity * 100).toFixed(0)}%，但距离 ${Math.round(distance)}米略远，需人工确认`;
        } else {
          confidence = nameSimilarity * 0.5;
          reason = `名称相似度 ${(nameSimilarity * 100).toFixed(0)}%，但距离 ${Math.round(distance)}米较远，可能为不同点位`;
        }
      } else if (distance <= this.config.distanceThreshold) {
        confidence = 0.4 * nameSimilarity + 0.6 * (1 - distance / this.config.distanceThreshold);
        reason = `地理距离仅 ${Math.round(distance)}米，但名称相似度 ${(nameSimilarity * 100).toFixed(0)}%较低，可能为同一点位不同叫法`;
      }

      if (confidence > 0.3) {
        candidates.push({
          targetPoint: point,
          sourceData,
          nameSimilarity,
          distance,
          confidence,
          reason,
        });
      }
    }

    return candidates.sort((a, b) => b.confidence - a.confidence);
  }

  shouldAutoMerge(candidate: MergeCandidate): boolean {
    return candidate.confidence >= this.config.autoMergeConfidence;
  }

  shouldReview(candidate: MergeCandidate): boolean {
    return candidate.confidence >= this.config.nameSimilarityThreshold && 
           candidate.confidence < this.config.autoMergeConfidence;
  }

  detectConflicts(point: GarbagePoint): ConflictInfo[] {
    const conflicts: ConflictInfo[] = [];
    const gisSources = point.sources.filter(s => s.sourceType === SourceType.GIS);
    const inspectionSources = point.sources.filter(s => s.sourceType === SourceType.INSPECTION);
    const residentSources = point.sources.filter(s => s.sourceType === SourceType.RESIDENT);

    if (gisSources.length > 1) {
      const names = gisSources.map(s => s.sourceName);
      const uniqueNames = [...new Set(names)];
      if (uniqueNames.length > 1) {
        conflicts.push({
          type: 'multiple_sources',
          description: '存在多条GIS数据指向此点位',
          evidence: gisSources.map(s => ({
            source: s,
            value: s.sourceName,
          })),
        });
      }
    }

    if (gisSources.length > 0 && inspectionSources.length > 0) {
      const gisSource = gisSources[0];
      for (const inspectionSource of inspectionSources) {
        const gisLat = gisSource.rawData.coordinates?.[1] ?? gisSource.rawData.lat;
        const gisLng = gisSource.rawData.coordinates?.[0] ?? gisSource.rawData.lng;
        const inspLat = inspectionSource.rawData.exifLat;
        const inspLng = inspectionSource.rawData.exifLng;

        if (gisLat !== undefined && gisLng !== undefined && inspLat !== undefined && inspLng !== undefined) {
          const distance = haversineDistance(gisLat, gisLng, inspLat, inspLng);
          if (distance > this.config.distanceThreshold) {
            conflicts.push({
              type: 'location',
              description: `GIS坐标与巡检照片EXIF坐标相差 ${Math.round(distance)}米`,
              evidence: [
                { source: gisSource, value: `(${gisLat.toFixed(4)}, ${gisLng.toFixed(4)})` },
                { source: inspectionSource, value: `(${inspLat.toFixed(4)}, ${inspLng.toFixed(4)})` },
              ],
            });
          }
        }

        const nameSimilarity = calculateNameSimilarity(gisSource.sourceName, inspectionSource.sourceName);
        if (nameSimilarity < this.config.nameSimilarityThreshold) {
          conflicts.push({
            type: 'name',
            description: `GIS名称与巡检照片名称相似度仅 ${(nameSimilarity * 100).toFixed(0)}%`,
            evidence: [
              { source: gisSource, value: gisSource.sourceName },
              { source: inspectionSource, value: inspectionSource.sourceName },
            ],
          });
        }
      }
    }

    if (gisSources.length > 0 && residentSources.length > 0) {
      const gisSource = gisSources[0];
      for (const residentSource of residentSources) {
        const nameSimilarity = calculateNameSimilarity(gisSource.sourceName, residentSource.sourceName);
        if (nameSimilarity < this.config.nameSimilarityThreshold) {
          conflicts.push({
            type: 'name',
            description: `居民反馈名称与GIS标准名称相似度仅 ${(nameSimilarity * 100).toFixed(0)}%`,
            evidence: [
              { source: gisSource, value: gisSource.sourceName },
              { source: residentSource, value: residentSource.sourceName },
            ],
          });
        }
      }
    }

    return conflicts;
  }

  createNewPointFromSource(sourceData: SourceData, operator: string): GarbagePoint {
    void operator;
    const lat = sourceData.rawData.lat ?? sourceData.rawData.exifLat ?? sourceData.rawData.coordinates?.[1];
    const lng = sourceData.rawData.lng ?? sourceData.rawData.exifLng ?? sourceData.rawData.coordinates?.[0];
    const address = sourceData.rawData.address || sourceData.sourceName;
    const street = sourceData.rawData.street || '未分配街道';

    return {
      id: generateShortId(),
      canonicalName: sourceData.sourceName,
      lat: lat || 0,
      lng: lng || 0,
      address,
      street,
      status: PointStatus.PENDING,
      mergeReason: `新建点位，来源：${sourceData.sourceType}`,
      sources: [{ ...sourceData, confidence: 1.0 }],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  mergeSourceToPoint(
    point: GarbagePoint,
    sourceData: SourceData,
    confidence: number,
    operator: string
  ): GarbagePoint {
    void operator;
    const existingSource = point.sources.find(s => s.id === sourceData.id);
    let newSources = [...point.sources];
    
    if (existingSource) {
      newSources = newSources.map(s => 
        s.id === sourceData.id 
          ? { ...sourceData, confidence }
          : s
      );
    } else {
      newSources.push({ ...sourceData, confidence });
    }

    let newStatus = point.status;
    let newMergeReason = point.mergeReason;

    if (confidence >= this.config.autoMergeConfidence) {
      const conflicts = this.detectConflicts({ ...point, sources: newSources });
      if (conflicts.length > 0) {
        newStatus = PointStatus.CONFLICT;
        newMergeReason = `自动归并后检测到 ${conflicts.length} 个冲突，需人工复核`;
      } else if (newStatus === PointStatus.PENDING) {
        newStatus = PointStatus.CONFIRMED;
        newMergeReason = `自动归并，置信度 ${(confidence * 100).toFixed(0)}%`;
      }
    } else if (confidence >= this.config.nameSimilarityThreshold) {
      newStatus = PointStatus.PENDING;
      newMergeReason = `待人工复核，置信度 ${(confidence * 100).toFixed(0)}%`;
    }

    return {
      ...point,
      sources: newSources,
      status: newStatus,
      mergeReason: newMergeReason,
      updatedAt: new Date(),
    };
  }

  splitPoint(point: GarbagePoint, sourceToSplit: SourceData, operator: string): { mainPoint: GarbagePoint; newPoint: GarbagePoint } {
    const mainSources = point.sources.filter(s => s.id !== sourceToSplit.id);
    const mainPoint: GarbagePoint = {
      ...point,
      sources: mainSources,
      status: mainSources.length > 1 ? point.status : PointStatus.PENDING,
      mergeReason: `拆分来源：${sourceToSplit.sourceName}`,
      updatedAt: new Date(),
    };

    const newPoint = this.createNewPointFromSource(sourceToSplit, operator);
    newPoint.mergeReason = `从 ${point.canonicalName} 拆分，判定为独立点位`;

    return { mainPoint, newPoint };
  }

  confirmPoint(point: GarbagePoint, operator: string, reason: string): GarbagePoint {
    return {
      ...point,
      status: PointStatus.CONFIRMED,
      mergeReason: reason || point.mergeReason,
      updatedAt: new Date(),
    };
  }

  rejectMerge(point: GarbagePoint, sourceToReject: SourceData, operator: string, reason: string): GarbagePoint {
    return {
      ...point,
      sources: point.sources.filter(s => s.id !== sourceToReject.id),
      status: point.sources.length <= 2 ? PointStatus.PENDING : point.status,
      mergeReason: `驳回来源：${sourceToReject.sourceName}，理由：${reason}`,
      updatedAt: new Date(),
    };
  }

  getSuggestedActions(candidate: MergeCandidate): { action: string; description: string; priority: 'high' | 'medium' | 'low' }[] {
    const actions: { action: string; description: string; priority: 'high' | 'medium' | 'low' }[] = [];

    if (candidate.confidence >= this.config.autoMergeConfidence) {
      actions.push({
        action: '自动归并',
        description: `置信度 ${(candidate.confidence * 100).toFixed(0)}%，建议自动归并到「${candidate.targetPoint.canonicalName}」`,
        priority: 'high',
      });
    } else if (candidate.confidence >= this.config.nameSimilarityThreshold) {
      actions.push({
        action: '确认归并',
        description: `名称相似度 ${(candidate.nameSimilarity * 100).toFixed(0)}%，距离 ${Math.round(candidate.distance)}米，建议人工确认后归并`,
        priority: 'medium',
      });
      actions.push({
        action: '作为新点位',
        description: `如果确认是不同点位，可创建为独立点位`,
        priority: 'low',
      });
    } else if (candidate.distance <= this.config.distanceThreshold) {
      actions.push({
        action: '标记待补充',
        description: `距离仅 ${Math.round(candidate.distance)}米，但名称差异较大，建议补充调查后再判定`,
        priority: 'medium',
      });
    } else {
      actions.push({
        action: '作为新点位',
        description: `距离 ${Math.round(candidate.distance)}米，名称相似度低，建议作为独立点位`,
        priority: 'high',
      });
    }

    return actions;
  }
}

export const mergeEngine = new MergeEngine();
