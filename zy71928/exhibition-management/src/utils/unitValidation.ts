import { DimensionUnit, Artwork, Anomaly, ChangeLog, User } from '@/types';

const unitConversionFactors: Record<DimensionUnit, number> = {
  mm: 1,
  cm: 10,
  m: 1000,
  inch: 25.4,
  unknown: 1,
};

const standardUnits: DimensionUnit[] = ['cm', 'mm'];

export function detectUnitAnomaly(
  artwork: Artwork,
  historicalRecords?: Array<{ unit: DimensionUnit; width: number; height: number }>
): Anomaly | null {
  const reasons: string[] = [];

  if (artwork.unit === 'unknown') {
    reasons.push('尺寸单位未指定');
  }

  if (!artwork.unitConfirmed && artwork.manualChange) {
    reasons.push('单位经过手工修改但未最终确认');
  }

  if (historicalRecords && historicalRecords.length > 0) {
    const latestRecord = historicalRecords[historicalRecords.length - 1];
    if (latestRecord.unit !== artwork.unit) {
      const oldMm = latestRecord.width * unitConversionFactors[latestRecord.unit];
      const newMm = artwork.width * unitConversionFactors[artwork.unit];
      const ratio = Math.max(oldMm, newMm) / Math.min(oldMm, newMm);
      
      if (ratio > 1.5 && ratio < 15) {
        reasons.push(`单位从${latestRecord.unit}改为${artwork.unit}，尺寸变化${ratio.toFixed(1)}倍，疑似单位标注错误`);
      }
    }
  }

  if (artwork.width > 500 && artwork.unit === 'cm') {
    reasons.push('宽度超过500cm，请确认单位是否正确');
  }
  if (artwork.height > 500 && artwork.unit === 'cm') {
    reasons.push('高度超过500cm，请确认单位是否正确');
  }

  if (reasons.length === 0) return null;

  return {
    id: `an-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    exhibitionId: artwork.id.startsWith('a') ? 'exh-001' : '',
    type: 'dimension_unit_error',
    description: reasons.join('；'),
    entityId: artwork.id,
    entityType: 'artwork',
    severity: 'danger',
    confirmed: false,
    createdAt: new Date().toISOString(),
  };
}

export function validateAndConvertUnit(
  artwork: Artwork,
  targetUnit: DimensionUnit,
  operator: User
): { artwork: Artwork; changeLog: ChangeLog; anomaly?: Anomaly } {
  const oldUnit = artwork.unit;
  const oldWidth = artwork.width;
  const oldHeight = artwork.height;
  const oldDepth = artwork.depth;

  const factor = unitConversionFactors[oldUnit] / unitConversionFactors[targetUnit];

  const newArtwork: Artwork = {
    ...artwork,
    width: Number((oldWidth * factor).toFixed(2)),
    height: Number((oldHeight * factor).toFixed(2)),
    depth: oldDepth ? Number((oldDepth * factor).toFixed(2)) : undefined,
    unit: targetUnit,
    lastModifiedBy: operator.id,
    lastModifiedAt: new Date().toISOString(),
  };

  const changeLog: ChangeLog = {
    id: `cl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    exhibitionId: artwork.id.startsWith('a') ? 'exh-001' : '',
    changeType: 'dimension_unit_changed',
    entityId: artwork.id,
    entityType: 'artwork',
    oldValue: `${oldWidth} × ${oldHeight} ${oldUnit}`,
    newValue: `${newArtwork.width} × ${newArtwork.height} ${targetUnit}`,
    reason: `画廊助理${operator.name}核对原作后修正单位`,
    operator: operator.id,
    timestamp: new Date().toISOString(),
    requiresConfirmation: true,
    confirmed: false,
  };

  const anomaly = detectUnitAnomaly(newArtwork) ?? undefined;

  return { artwork: newArtwork, changeLog, anomaly };
}

export function normalizeDimensions(artwork: Artwork): string {
  const displayUnit = standardUnits.includes(artwork.unit) ? artwork.unit : 'cm';
  const factor = unitConversionFactors[artwork.unit] / unitConversionFactors[displayUnit];
  
  const w = Number((artwork.width * factor).toFixed(1));
  const h = Number((artwork.height * factor).toFixed(1));
  
  if (artwork.depth) {
    const d = Number((artwork.depth * factor).toFixed(1));
    return `${w} × ${h} × ${d} ${displayUnit}`;
  }
  return `${w} × ${h} ${displayUnit}`;
}

export function checkUnitConsistency(artworks: Artwork[]): {
  consistent: boolean;
  issues: Array<{ artworkId: string; artworkTitle: string; issues: string[] }>;
} {
  const issues: Array<{ artworkId: string; artworkTitle: string; issues: string[] }> = [];

  for (const artwork of artworks) {
    const artworkIssues: string[] = [];
    
    if (!artwork.unitConfirmed) {
      artworkIssues.push('单位未确认');
    }
    if (artwork.unit === 'unknown') {
      artworkIssues.push('单位未知');
    }
    
    if (artworkIssues.length > 0) {
      issues.push({
        artworkId: artwork.id,
        artworkTitle: artwork.title,
        issues: artworkIssues,
      });
    }
  }

  return {
    consistent: issues.length === 0,
    issues,
  };
}
