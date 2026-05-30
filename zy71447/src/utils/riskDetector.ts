import type {
  InstrumentModel,
  FrequencySample,
  Hotspot,
  SectionParams,
  RiskItem,
  BandType,
  Point3D,
} from '@/types';
import { BAND_CONFIGS, BUSINESS_EXPLANATIONS } from '@/types';

export class RiskDetector {
  static detectSectionOcclusion(
    instrument: InstrumentModel,
    sectionParams: SectionParams
  ): RiskItem | null {
    const occlusionRatio = this.calculateOcclusionRatio(instrument, sectionParams);
    const threshold = 0.3;

    if (occlusionRatio > threshold) {
      const explanation = BUSINESS_EXPLANATIONS.find(
        (e) => e.featureKey === 'section_cut'
      )!;

      return {
        id: `risk-occlusion-${Date.now()}`,
        type: 'section_occlusion',
        instrumentId: instrument.id,
        description: `剖面遮挡率${(occlusionRatio * 100).toFixed(1)}%，超过${threshold * 100}%阈值`,
        severity: occlusionRatio > 0.5 ? 'high' : 'medium',
        rawDataSnapshot: {
          occlusionRatio,
          threshold,
          sectionParams: { ...sectionParams },
          instrumentDimensions: { ...instrument.dimensions },
          materialGroups: instrument.materialGroups.map((g) => ({
            id: g.id,
            name: g.name,
            visible: g.visible,
          })),
        },
        businessInterpretation: explanation.explanation,
        detectedAt: new Date().toISOString(),
      };
    }

    return null;
  }

  static detectBandMismatch(
    samples: FrequencySample[],
    labeledBand: BandType
  ): RiskItem | null {
    if (samples.length === 0) return null;

    const deviation = this.calculateFrequencyDeviation(samples, labeledBand);
    const threshold = 0.15;

    if (deviation > threshold) {
      const explanation = BUSINESS_EXPLANATIONS.find(
        (e) => e.featureKey === 'band_switch'
      )!;

      const bandConfig = BAND_CONFIGS.find((b) => b.key === labeledBand)!;

      return {
        id: `risk-band-${Date.now()}`,
        type: 'band_mismatch',
        instrumentId: samples[0].instrumentId,
        description: `标注频段「${bandConfig.label}」与采样数据偏差${(deviation * 100).toFixed(1)}%，超过${threshold * 100}%阈值`,
        severity: deviation > 0.25 ? 'high' : 'medium',
        rawDataSnapshot: {
          deviation,
          threshold,
          labeledBand,
          bandRange: { min: bandConfig.minFreq, max: bandConfig.maxFreq },
          sampleCount: samples.length,
          sampleFrequencies: samples.map((s) => s.frequency).slice(0, 10),
          dataSources: [...new Set(samples.map((s) => s.dataSource))],
        },
        businessInterpretation: explanation.explanation,
        detectedAt: new Date().toISOString(),
      };
    }

    return null;
  }

  static detectHotspotMissing(
    hotspots: Hotspot[],
    sectionParams: SectionParams
  ): RiskItem | null {
    if (hotspots.length === 0) return null;

    const missingPoints = hotspots.filter(
      (h) => !this.isPointInSection(h.position, sectionParams)
    );

    if (missingPoints.length > 0) {
      const explanation = BUSINESS_EXPLANATIONS.find(
        (e) => e.featureKey === 'hotspot_annotation'
      )!;

      return {
        id: `risk-hotspot-${Date.now()}`,
        type: 'hotspot_missing',
        instrumentId: hotspots[0].instrumentId,
        description: `${missingPoints.length}个讲解点落在剖面外：${missingPoints.map((p) => p.name).join('、')}`,
        severity: missingPoints.length > 2 ? 'high' : 'medium',
        rawDataSnapshot: {
          missingCount: missingPoints.length,
          totalCount: hotspots.length,
          missingPoints: missingPoints.map((p) => ({
            id: p.id,
            name: p.name,
            position: { ...p.position },
            category: p.category,
          })),
          sectionParams: { ...sectionParams },
        },
        businessInterpretation: explanation.explanation,
        detectedAt: new Date().toISOString(),
      };
    }

    return null;
  }

  private static calculateOcclusionRatio(
    instrument: InstrumentModel,
    sectionParams: SectionParams
  ): number {
    const dim = instrument.dimensions;
    const visibleMaterials = instrument.materialGroups.filter((g) => g.visible);

    let totalArea = 0;
    let occludedArea = 0;

    for (let i = 0; i < visibleMaterials.length; i++) {
      const mat = visibleMaterials[i];
      const layerDepth = dim.depth / visibleMaterials.length;
      const layerStart = -dim.depth / 2 + i * layerDepth;
      const layerEnd = layerStart + layerDepth;

      const area = this.calculateCrossSectionArea(dim, sectionParams, layerStart, layerEnd);
      totalArea += area;

      if (i > 0 && !this.isSectionPositionWithinLayer(sectionParams, layerStart, layerEnd)) {
        occludedArea += area * 0.4;
      }
    }

    if (sectionParams.highlightMaterial) {
      const highlighted = instrument.materialGroups.find(
        (g) => g.id === sectionParams.highlightMaterial
      );
      if (highlighted && !highlighted.visible) {
        occludedArea += totalArea * 0.2;
      }
    }

    if (!sectionParams.showInternal) {
      occludedArea += totalArea * 0.15;
    }

    return totalArea > 0 ? Math.min(occludedArea / totalArea, 0.9) : 0;
  }

  private static calculateCrossSectionArea(
    dim: { width: number; height: number; depth: number },
    params: SectionParams,
    layerStart: number,
    layerEnd: number
  ): number {
    const pos = params.position;

    switch (params.axis) {
      case 'x':
        if (pos >= -dim.width / 2 && pos <= dim.width / 2) {
          const depth = Math.min(layerEnd, dim.depth / 2) - Math.max(layerStart, -dim.depth / 2);
          return Math.max(0, depth * dim.height);
        }
        return 0;
      case 'y':
        if (pos >= -dim.height / 2 && pos <= dim.height / 2) {
          const depth = Math.min(layerEnd, dim.depth / 2) - Math.max(layerStart, -dim.depth / 2);
          return Math.max(0, depth * dim.width);
        }
        return 0;
      case 'z':
        if (pos >= layerStart && pos <= layerEnd) {
          return dim.width * dim.height * 0.8;
        }
        return 0;
      default:
        return 0;
    }
  }

  private static isSectionPositionWithinLayer(
    params: SectionParams,
    layerStart: number,
    layerEnd: number
  ): boolean {
    return params.axis === 'z' && params.position >= layerStart && params.position <= layerEnd;
  }

  private static calculateFrequencyDeviation(
    samples: FrequencySample[],
    labeledBand: BandType
  ): number {
    const bandConfig = BAND_CONFIGS.find((b) => b.key === labeledBand);
    if (!bandConfig) return 1;

    const bandMid = (bandConfig.minFreq + bandConfig.maxFreq) / 2;
    const sampleMid = samples.reduce((sum, s) => sum + s.frequency, 0) / samples.length;

    return Math.abs(sampleMid - bandMid) / bandMid;
  }

  private static isPointInSection(point: Point3D, params: SectionParams): boolean {
    const tolerance = 0.02;

    switch (params.axis) {
      case 'x':
        return Math.abs(point.x - params.position) <= tolerance;
      case 'y':
        return Math.abs(point.y - params.position) <= tolerance;
      case 'z':
        return Math.abs(point.z - params.position) <= tolerance;
      default:
        return false;
    }
  }

  static detectAllRisks(
    instrument: InstrumentModel,
    samples: FrequencySample[],
    hotspots: Hotspot[],
    sectionParams: SectionParams,
    currentBand: BandType
  ): RiskItem[] {
    const risks: RiskItem[] = [];

    const occlusionRisk = this.detectSectionOcclusion(instrument, sectionParams);
    if (occlusionRisk) risks.push(occlusionRisk);

    const bandRisk = this.detectBandMismatch(samples, currentBand);
    if (bandRisk) risks.push(bandRisk);

    const hotspotRisk = this.detectHotspotMissing(hotspots, sectionParams);
    if (hotspotRisk) risks.push(hotspotRisk);

    return risks;
  }
}
