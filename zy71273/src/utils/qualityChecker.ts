import { Artwork, QualityReport } from '../types/artwork';
import { FilterFailureInfo } from '../types/filter';

export function checkTransparentBgRisk(artwork: Artwork): boolean {
  if (artwork.hue === null || artwork.saturation === null || artwork.lightness === null) return false;
  return artwork.saturation < 5 && artwork.lightness > 90;
}

export function checkExtremeColorRisk(artwork: Artwork): boolean {
  if (artwork.hue === null || artwork.lightness === null) return false;
  const hueEdge = artwork.hue < 10 || artwork.hue > 350;
  const lightnessEdge = artwork.lightness < 5 || artwork.lightness > 95;
  return hueEdge || lightnessEdge;
}

export function checkMissingData(artwork: Artwork): boolean {
  return artwork.hue === null || artwork.lightness === null || artwork.saturation === null;
}

export function checkVersionConflict(artwork: Artwork): boolean {
  return artwork.versionHistory.length > 1;
}

export function checkFilterFailure(filteredCount: number, minCount: number = 2): FilterFailureInfo {
  const failed = filteredCount < minCount;
  return {
    failed,
    count: filteredCount,
    minCount,
    suggestions: failed ? [
      '扩大筛选范围，选择更多班级',
      '检查班级标签数据质量',
      '调整色彩范围筛选条件',
      '尝试移除部分筛选条件'
    ] : [],
    recommendedClassIds: []
  };
}

export function generateQualityReports(artworks: Artwork[]): QualityReport[] {
  const reports: QualityReport[] = [];

  artworks.forEach(artwork => {
    if (checkTransparentBgRisk(artwork)) {
      reports.push({
        id: `alert-${artwork.id}-transparent`,
        artworkId: artwork.id,
        alertType: 'transparent_bg',
        severity: 'warning',
        description: '疑似透明背景误采：低饱和度、高明度特征明显，可能是PNG透明通道被误识别为白色',
        suggestion: {
          action: 'resample',
          excludeTransparent: true,
          message: '建议排除透明区域后重新采样'
        }
      });
    }

    if (checkExtremeColorRisk(artwork)) {
      reports.push({
        id: `alert-${artwork.id}-extreme`,
        artworkId: artwork.id,
        alertType: 'extreme_color',
        severity: 'info',
        description: '颜色处于空间边缘区域，可能被空间边界遮挡影响观察',
        suggestion: {
          action: 'zoom_edge',
          message: '可使用边缘放大视图查看详情'
        }
      });
    }

    if (checkMissingData(artwork)) {
      reports.push({
        id: `alert-${artwork.id}-missing`,
        artworkId: artwork.id,
        alertType: 'missing_data',
        severity: 'error',
        description: 'HSL色彩数据不完整，该作品可能显示在默认位置',
        suggestion: {
          action: 'complete_data',
          message: '请补充完整的色彩采样数据'
        }
      });
    }

    if (checkVersionConflict(artwork)) {
      reports.push({
        id: `alert-${artwork.id}-version`,
        artworkId: artwork.id,
        alertType: 'version_conflict',
        severity: 'info',
        description: `该作品存在${artwork.versionHistory.length}个版本的数据，请确认使用正确版本`,
        suggestion: {
          action: 'check_version',
          message: '可在详情面板中查看版本历史并切换'
        }
      });
    }
  });

  return reports;
}

export function updateArtworkQualityFlags(artwork: Artwork): Artwork {
  return {
    ...artwork,
    qualityFlags: {
      transparentBgRisk: checkTransparentBgRisk(artwork),
      extremeColorRisk: checkExtremeColorRisk(artwork),
      missingData: checkMissingData(artwork),
      versionConflict: checkVersionConflict(artwork)
    }
  };
}
