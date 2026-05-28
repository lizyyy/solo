import { useMemo } from 'react';
import type { 
  Gallery, LightSource, Artwork, Exhibition, 
  SamplingData, Risk, RiskSeverity, RiskType, Wall
} from '@/types';
import { LIGHT_RESISTANCE_THRESHOLDS } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { calculateTotalIllumination, checkLightPenetration } from './useLightCalculation';
import { calculateCumulativeExposure } from './useExposureCalculation';

function getSeverity(exceedRatio: number): RiskSeverity {
  if (exceedRatio <= 5) return 'low';
  if (exceedRatio <= 15) return 'medium';
  if (exceedRatio <= 30) return 'high';
  return 'critical';
}

export function detectOverIlluminationRisks(
  artworks: Artwork[],
  lightSources: LightSource[],
  walls: Wall[]
): Risk[] {
  const risks: Risk[] = [];
  const now = new Date().toISOString();

  artworks.forEach(artwork => {
    const artworkPoint = { x: artwork.posX, y: artwork.posY, z: artwork.posZ };
    const illumination = calculateTotalIllumination(lightSources, artworkPoint, walls);
    const threshold = LIGHT_RESISTANCE_THRESHOLDS[artwork.lightResistanceGrade];
    
    if (illumination > threshold.maxInstantIllumination) {
      const exceedRatio = ((illumination - threshold.maxInstantIllumination) / threshold.maxInstantIllumination) * 100;
      
      risks.push({
        id: uuidv4(),
        type: 'over_illumination',
        severity: getSeverity(exceedRatio),
        status: 'detected',
        description: `${artwork.name} 照度超过 ${illumination.toFixed(1)}lux，限值 ${threshold.maxInstantIllumination}lux，超限 ${exceedRatio.toFixed(1)}%`,
        posX: artwork.posX,
        posY: artwork.posY,
        posZ: artwork.posZ,
        artworkId: artwork.id,
        measuredValue: Math.round(illumination),
        threshold: threshold.maxInstantIllumination,
        exceedRatio: Math.round(exceedRatio * 10) / 10,
        evidence: {
          notes: `作品耐光等级: ${artwork.lightResistanceGrade}，建议调整光源角度或降低光源功率`
        },
        detectedAt: now
      });
    }
  });

  return risks;
}

export function detectCumulativeLeakRisks(
  artworks: Artwork[],
  exhibition: Exhibition,
  samplingData: SamplingData[]
): Risk[] {
  const risks: Risk[] = [];
  const now = new Date().toISOString();

  artworks.forEach(artwork => {
    const artworkSamplingData = samplingData.filter(d => {
      const pointId = d.samplingPointId;
      const sp = parseInt(pointId.replace('sp-', ''));
      return !isNaN(sp) && sp >= 1 && sp <= 5;
    });

    if (artworkSamplingData.length > 0) {
      const avgIllumination = artworkSamplingData.reduce((sum, d) => sum + d.measuredValue, 0) / artworkSamplingData.length;
      
      const result = calculateCumulativeExposure(
        artwork,
        exhibition,
        avgIllumination,
        artworkSamplingData
      );

      if (result.leakageDays.length > 0) {
        const threshold = LIGHT_RESISTANCE_THRESHOLDS[artwork.lightResistanceGrade];
        const annualExposure = result.totalExposure;
        const maxExposure = threshold.maxAnnualExposure * 0.25;
        
        if (annualExposure > maxExposure * 0.8) {
          const exceedRatio = ((annualExposure - maxExposure * 0.8) / (maxExposure * 0.8)) * 100;
          
          risks.push({
            id: uuidv4(),
            type: 'cumulative_leak',
            severity: getSeverity(exceedRatio),
            status: 'detected',
            description: `${artwork.name} 累计曝光计算存在 ${result.leakageDays.length} 天采样数据缺失，累计曝光量 ${annualExposure.toFixed(0)} lux·h`,
            posX: artwork.posX,
            posY: artwork.posY,
            posZ: artwork.posZ,
            artworkId: artwork.id,
            measuredValue: Math.round(annualExposure),
            threshold: Math.round(maxExposure * 0.8),
            exceedRatio: Math.round(exceedRatio * 10) / 10,
            evidence: {
              notes: `缺失日期: ${result.leakageDays.slice(0, 5).join(', ')}${result.leakageDays.length > 5 ? '...' : ''}`
            },
            detectedAt: now
          });
        }
      }
    }
  });

  return risks;
}

export function detectLightPenetrationRisks(
  lightSources: LightSource[],
  walls: Wall[],
  galleryWidth: number,
  galleryDepth: number,
  artworks: Artwork[]
): Risk[] {
  const risks: Risk[] = [];
  const now = new Date().toISOString();

  lightSources.forEach(lightSource => {
    const result = checkLightPenetration(lightSource, walls, galleryWidth, galleryDepth);
    
    if (result.hasPenetration && result.penetrationPoint) {
      const affectedArtworks = artworks.filter(artwork => {
        const dx = artwork.posX - result.penetrationPoint!.x;
        const dz = artwork.posZ - result.penetrationPoint!.z;
        return Math.sqrt(dx * dx + dz * dz) < 3;
      });
      
      const threshold = 200;
      const measuredValue = 220;
      const exceedRatio = ((measuredValue - threshold) / threshold) * 100;
      
      risks.push({
        id: uuidv4(),
        type: 'light_penetration',
        severity: 'critical',
        status: 'detected',
        description: `${lightSource.name} 光线穿透墙体 ${result.wallId}，影响 ${affectedArtworks.map(a => a.name).join('、')}`,
        posX: result.penetrationPoint.x,
        posY: result.penetrationPoint.y,
        posZ: result.penetrationPoint.z,
        lightSourceId: lightSource.id,
        artworkId: affectedArtworks[0]?.id,
        measuredValue,
        threshold,
        exceedRatio: Math.round(exceedRatio * 10) / 10,
        evidence: {
          notes: '隔墙透光，建议调整光源角度或增加遮光板'
        },
        detectedAt: now
      });
    }
  });

  return risks;
}

export function detectAllRisks(
  gallery: Gallery | null,
  lightSources: LightSource[],
  artworks: Artwork[],
  exhibition: Exhibition | null,
  samplingData: SamplingData[],
  includeRayTracing: boolean = true
): Risk[] {
  if (!gallery || !exhibition) return [];

  const overIlluminationRisks = detectOverIlluminationRisks(
    artworks,
    lightSources,
    gallery.walls
  );

  const cumulativeLeakRisks = detectCumulativeLeakRisks(
    artworks,
    exhibition,
    samplingData
  );

  const lightPenetrationRisks = includeRayTracing
    ? detectLightPenetrationRisks(
        lightSources,
        gallery.walls,
        gallery.width,
        gallery.depth,
        artworks
      )
    : [];

  return [...overIlluminationRisks, ...cumulativeLeakRisks, ...lightPenetrationRisks];
}

export function useRiskDetection(
  gallery: Gallery | null,
  lightSources: LightSource[],
  artworks: Artwork[],
  exhibition: Exhibition | null,
  samplingData: SamplingData[],
  existingRisks: Risk[]
) {
  const detectedRisks = useMemo(() => {
    return detectAllRisks(
      gallery,
      lightSources,
      artworks,
      exhibition,
      samplingData,
      true
    );
  }, [gallery, lightSources, artworks, exhibition, samplingData]);

  const risks = useMemo(() => {
    const acknowledgedIds = new Set(
      existingRisks.filter(r => r.status !== 'detected').map(r => r.id)
    );
    
    const newRisks = detectedRisks.filter(r => !acknowledgedIds.has(r.id));
    
    return [...existingRisks.filter(r => r.status !== 'detected'), ...newRisks];
  }, [detectedRisks, existingRisks]);

  const summary = useMemo(() => {
    return {
      total: risks.length,
      overIllumination: risks.filter(r => r.type === 'over_illumination').length,
      cumulativeLeak: risks.filter(r => r.type === 'cumulative_leak').length,
      lightPenetration: risks.filter(r => r.type === 'light_penetration').length,
      bySeverity: {
        low: risks.filter(r => r.severity === 'low').length,
        medium: risks.filter(r => r.severity === 'medium').length,
        high: risks.filter(r => r.severity === 'high').length,
        critical: risks.filter(r => r.severity === 'critical').length
      },
      byStatus: {
        detected: risks.filter(r => r.status === 'detected').length,
        acknowledged: risks.filter(r => r.status === 'acknowledged').length,
        resolved: risks.filter(r => r.status === 'resolved').length
      }
    };
  }, [risks]);

  const getRisksByType = (type: RiskType) => risks.filter(r => r.type === type);
  const getRisksByArtwork = (artworkId: string) => risks.filter(r => r.artworkId === artworkId);
  const getRisksByLightSource = (lightSourceId: string) => risks.filter(r => r.lightSourceId === lightSourceId);

  return {
    risks,
    summary,
    getRisksByType,
    getRisksByArtwork,
    getRisksByLightSource
  };
}
