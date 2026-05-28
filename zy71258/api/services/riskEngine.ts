import { v4 as uuidv4 } from 'uuid';
import type { Risk, Gallery, LightSource, Artwork, SamplingData, Exhibition, RiskType, RiskSeverity } from '../../src/types/index.js';
import { LIGHT_RESISTANCE_THRESHOLDS } from '../../src/types/index.js';

interface Point3D {
  x: number;
  y: number;
  z: number;
}

interface RiskDetectionContext {
  gallery: Gallery;
  lightSources: LightSource[];
  artworks: Artwork[];
  samplings: SamplingData[];
  exhibitions: Exhibition[];
}

export class RiskEngine {
  async detectRisks(context: RiskDetectionContext): Promise<Risk[]> {
    const risks: Risk[] = [];

    const overIlluminationRisks = await this.detectOverIllumination(context);
    risks.push(...overIlluminationRisks);

    const cumulativeLeakRisks = await this.detectCumulativeLeak(context);
    risks.push(...cumulativeLeakRisks);

    const lightPenetrationRisks = await this.detectLightPenetration(context);
    risks.push(...lightPenetrationRisks);

    return risks;
  }

  async detectOverIllumination(context: RiskDetectionContext): Promise<Risk[]> {
    const { artworks, lightSources, samplings } = context;
    const risks: Risk[] = [];

    for (const artwork of artworks) {
      const threshold = LIGHT_RESISTANCE_THRESHOLDS[artwork.lightResistanceGrade];
      
      const artworkSamplings = samplings.filter(s => {
        const samplingPoint = this.getSamplingPointForArtwork(artwork, context);
        return samplingPoint && s.samplingPointId === samplingPoint.id;
      });

      const avgIllumination = artworkSamplings.length > 0
        ? artworkSamplings.reduce((sum, s) => sum + s.measuredValue, 0) / artworkSamplings.length
        : this.calculateIllumination(artwork, lightSources);

      if (avgIllumination > threshold.maxInstantIllumination) {
        const exceedRatio = avgIllumination / threshold.maxInstantIllumination;
        const severity = this.getSeverity(exceedRatio);

        risks.push({
          id: uuidv4(),
          type: 'over_illumination',
          severity,
          status: 'detected',
          description: `作品"${artwork.name}"照度超限，当前${avgIllumination.toFixed(1)}lux，阈值${threshold.maxInstantIllumination}lux`,
          posX: artwork.posX,
          posY: artwork.posY,
          posZ: artwork.posZ,
          artworkId: artwork.id,
          measuredValue: avgIllumination,
          threshold: threshold.maxInstantIllumination,
          exceedRatio,
          evidence: {
            samplingDataRef: artworkSamplings.length > 0 ? artworkSamplings[0].id : undefined,
            notes: `基于${artworkSamplings.length}个采样点计算平均值`
          },
          detectedAt: new Date().toISOString(),
        });
      }
    }

    return risks;
  }

  async detectCumulativeLeak(context: RiskDetectionContext): Promise<Risk[]> {
    const { artworks, exhibitions, samplings } = context;
    const risks: Risk[] = [];

    const ongoingExhibitions = exhibitions.filter(e => e.status === 'ongoing');

    for (const exhibition of ongoingExhibitions) {
      const exhibitionArtworks = artworks.filter(a => a.exhibitionId === exhibition.id);

      for (const artwork of exhibitionArtworks) {
        const threshold = LIGHT_RESISTANCE_THRESHOLDS[artwork.lightResistanceGrade];

        const exposureResult = this.calculateCumulativeExposure(
          artwork,
          exhibition,
          samplings
        );

        if (exposureResult.leakageDays.length > 0) {
          const avgDailyExposure = exposureResult.totalExposure / Math.max(1, exposureResult.exposureByDay.length);
          const annualProjection = avgDailyExposure * 365;
          const exceedRatio = annualProjection / threshold.maxAnnualExposure;
          const severity = this.getSeverity(exceedRatio);

          risks.push({
            id: uuidv4(),
            type: 'cumulative_leak',
            severity,
            status: 'detected',
            description: `作品"${artwork.name}"展期累计漏算，预计年累计曝光${annualProjection.toFixed(0)}lux·h，阈值${threshold.maxAnnualExposure}lux·h`,
            posX: artwork.posX,
            posY: artwork.posY,
            posZ: artwork.posZ,
            artworkId: artwork.id,
            measuredValue: annualProjection,
            threshold: threshold.maxAnnualExposure,
            exceedRatio,
            evidence: {
              notes: `漏算天数: ${exposureResult.leakageDays.join(', ')}，累计曝光: ${exposureResult.totalExposure.toFixed(2)}lux·h`
            },
            detectedAt: new Date().toISOString(),
          });
        }
      }
    }

    return risks;
  }

  async detectLightPenetration(context: RiskDetectionContext): Promise<Risk[]> {
    const { gallery, lightSources, artworks } = context;
    const risks: Risk[] = [];

    for (const lightSource of lightSources) {
      for (const wall of gallery.walls) {
        if (this.doesLightPassThroughWall(lightSource, wall, artworks)) {
          const artworkInPath = this.findArtworkInLightPath(lightSource, wall, artworks);
          
          risks.push({
            id: uuidv4(),
            type: 'light_penetration',
            severity: 'medium',
            status: 'detected',
            description: `光源"${lightSource.name}"光线穿墙，可能影响对面作品`,
            posX: (wall.start.x + wall.end.x) / 2,
            posY: (wall.start.y + wall.end.y) / 2,
            posZ: (wall.start.z + wall.end.z) / 2,
            lightSourceId: lightSource.id,
            artworkId: artworkInPath?.id,
            measuredValue: wall.opacity,
            threshold: 0.1,
            exceedRatio: (1 - wall.opacity) / 0.1,
            evidence: {
              notes: `墙体不透明度: ${wall.opacity}，光源位置: (${lightSource.posX}, ${lightSource.posY}, ${lightSource.posZ})`
            },
            detectedAt: new Date().toISOString(),
          });
        }
      }
    }

    return risks;
  }

  private calculateIllumination(artwork: Artwork, lightSources: LightSource[]): number {
    let totalIllumination = 0;

    for (const source of lightSources) {
      if (source.galleryId !== artwork.galleryId) continue;

      const distance = Math.sqrt(
        Math.pow(artwork.posX - source.posX, 2) +
        Math.pow(artwork.posY - source.posY, 2) +
        Math.pow(artwork.posZ - source.posZ, 2)
      );

      if (distance === 0) continue;

      const angleRad = source.beamAngle * (Math.PI / 180);
      const spotFactor = Math.max(0, Math.cos(angleRad / 2));
      
      const illumination = (source.intensity * source.power * spotFactor) / (4 * Math.PI * distance * distance);
      totalIllumination += illumination;
    }

    return totalIllumination;
  }

  private calculateCumulativeExposure(
    artwork: Artwork,
    exhibition: Exhibition,
    samplings: SamplingData[]
  ): {
    totalExposure: number;
    calculatedExposure: number;
    actualExposure: number;
    leakageDays: string[];
    exposureByDay: Array<{ date: string; exposure: number }>;
  } {
    const startDate = new Date(exhibition.startDate);
    const endDate = new Date(exhibition.endDate);
    const today = new Date();
    const actualEnd = new Date(Math.min(endDate.getTime(), today.getTime()));

    const exposureByDay: Array<{ date: string; exposure: number }> = [];
    const leakageDays: string[] = [];
    let totalExposure = 0;

    const artworkSamplings = samplings.filter(s => {
      const sampleDate = new Date(s.measuredAt);
      return sampleDate >= startDate && sampleDate <= actualEnd;
    });

    const dailySamples = new Map<string, number[]>();
    for (const sample of artworkSamplings) {
      const dateKey = new Date(sample.measuredAt).toISOString().split('T')[0];
      if (!dailySamples.has(dateKey)) {
        dailySamples.set(dateKey, []);
      }
      dailySamples.get(dateKey)!.push(sample.measuredValue);
    }

    for (let d = new Date(startDate); d <= actualEnd; d.setDate(d.getDate() + 1)) {
      const dateKey = d.toISOString().split('T')[0];
      const samples = dailySamples.get(dateKey) || [];
      
      let avgIllumination: number;
      if (samples.length > 0) {
        avgIllumination = samples.reduce((sum, v) => sum + v, 0) / samples.length;
      } else {
        avgIllumination = artwork.currentIllumination || 0;
        leakageDays.push(dateKey);
      }

      const dailyExposure = avgIllumination * exhibition.dailyOpenHours;
      totalExposure += dailyExposure;
      exposureByDay.push({ date: dateKey, exposure: dailyExposure });
    }

    return {
      totalExposure,
      calculatedExposure: totalExposure,
      actualExposure: totalExposure,
      leakageDays,
      exposureByDay,
    };
  }

  private doesLightPassThroughWall(lightSource: LightSource, wall: { start: Point3D; end: Point3D; opacity: number }, artworks: Artwork[]): boolean {
    if (wall.opacity >= 1) return false;

    const lightPos: Point3D = { x: lightSource.posX, y: lightSource.posY, z: lightSource.posZ };
    const lightDir = this.getLightDirection(lightSource);
    
    const wallCenter: Point3D = {
      x: (wall.start.x + wall.end.x) / 2,
      y: (wall.start.y + wall.end.y) / 2,
      z: (wall.start.z + wall.end.z) / 2,
    };

    const toWall = {
      x: wallCenter.x - lightPos.x,
      y: wallCenter.y - lightPos.y,
      z: wallCenter.z - lightPos.z,
    };

    const dot = lightDir.x * toWall.x + lightDir.y * toWall.y + lightDir.z * toWall.z;
    if (dot <= 0) return false;

    const distance = Math.sqrt(toWall.x * toWall.x + toWall.y * toWall.y + toWall.z * toWall.z);
    if (distance > 20) return false;

    const beamRadius = distance * Math.tan((lightSource.beamAngle * Math.PI / 180) / 2);
    const wallLength = Math.sqrt(
      Math.pow(wall.end.x - wall.start.x, 2) +
      Math.pow(wall.end.z - wall.start.z, 2)
    );

    const projection = this.projectPointToLine(lightPos, { x: lightPos.x + lightDir.x, y: lightPos.y + lightDir.y, z: lightPos.z + lightDir.z }, wallCenter);
    const distToWallLine = Math.sqrt(
      Math.pow(wallCenter.x - projection.x, 2) +
      Math.pow(wallCenter.z - projection.z, 2)
    );

    if (distToWallLine > beamRadius + wallLength / 2) return false;

    const artworksOnOtherSide = artworks.filter(a => {
      const toArtwork = {
        x: a.posX - lightPos.x,
        y: a.posY - lightPos.y,
        z: a.posZ - lightPos.z,
      };
      const artworkDist = Math.sqrt(toArtwork.x * toArtwork.x + toArtwork.y * toArtwork.y + toArtwork.z * toArtwork.z);
      return artworkDist > distance;
    });

    return artworksOnOtherSide.length > 0;
  }

  private getLightDirection(lightSource: LightSource): Point3D {
    const angleX = lightSource.angleX * (Math.PI / 180);
    const angleY = lightSource.angleY * (Math.PI / 180);
    const angleZ = lightSource.angleZ * (Math.PI / 180);

    return {
      x: Math.cos(angleY) * Math.cos(angleX),
      y: Math.sin(angleX),
      z: Math.sin(angleY) * Math.cos(angleX),
    };
  }

  private projectPointToLine(lineStart: Point3D, lineEnd: Point3D, point: Point3D): Point3D {
    const line = { x: lineEnd.x - lineStart.x, y: lineEnd.y - lineStart.y, z: lineEnd.z - lineStart.z };
    const toPoint = { x: point.x - lineStart.x, y: point.y - lineStart.y, z: point.z - lineStart.z };
    
    const lineLenSq = line.x * line.x + line.y * line.y + line.z * line.z;
    if (lineLenSq === 0) return lineStart;
    
    const t = (toPoint.x * line.x + toPoint.y * line.y + toPoint.z * line.z) / lineLenSq;
    
    return {
      x: lineStart.x + t * line.x,
      y: lineStart.y + t * line.y,
      z: lineStart.z + t * line.z,
    };
  }

  private findArtworkInLightPath(
    lightSource: LightSource,
    wall: { start: Point3D; end: Point3D },
    artworks: Artwork[]
  ): Artwork | undefined {
    const lightPos: Point3D = { x: lightSource.posX, y: lightSource.posY, z: lightSource.posZ };
    const wallCenter: Point3D = {
      x: (wall.start.x + wall.end.x) / 2,
      y: (wall.start.y + wall.end.y) / 2,
      z: (wall.start.z + wall.end.z) / 2,
    };

    const toWall = {
      x: wallCenter.x - lightPos.x,
      y: wallCenter.y - lightPos.y,
      z: wallCenter.z - lightPos.z,
    };
    const wallDist = Math.sqrt(toWall.x * toWall.x + toWall.y * toWall.y + toWall.z * toWall.z);

    for (const artwork of artworks) {
      const toArtwork = {
        x: artwork.posX - lightPos.x,
        y: artwork.posY - lightPos.y,
        z: artwork.posZ - lightPos.z,
      };
      const artworkDist = Math.sqrt(toArtwork.x * toArtwork.x + toArtwork.y * toArtwork.y + toArtwork.z * toArtwork.z);

      if (artworkDist > wallDist) {
        const dot = (toArtwork.x * toWall.x + toArtwork.y * toWall.y + toArtwork.z * toWall.z) / (wallDist * artworkDist);
        if (dot > 0.7) {
          return artwork;
        }
      }
    }

    return undefined;
  }

  private getSamplingPointForArtwork(artwork: Artwork, _context: RiskDetectionContext): { id: string } | null {
    return { id: `sp_${artwork.id}` };
  }

  private getSeverity(exceedRatio: number): RiskSeverity {
    if (exceedRatio >= 3) return 'critical';
    if (exceedRatio >= 2) return 'high';
    if (exceedRatio >= 1.5) return 'medium';
    return 'low';
  }

  getRiskTypeLabel(type: RiskType): string {
    const labels: Record<RiskType, string> = {
      over_illumination: '照度超限',
      cumulative_leak: '累计漏算',
      light_penetration: '光线穿墙',
    };
    return labels[type];
  }

  getSeverityLabel(severity: RiskSeverity): string {
    const labels: Record<RiskSeverity, string> = {
      low: '低',
      medium: '中',
      high: '高',
      critical: '严重',
    };
    return labels[severity];
  }
}

export const riskEngine = new RiskEngine();
