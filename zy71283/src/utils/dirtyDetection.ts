import type { ColorSwatch, DirtyDataAlert, Work } from '@/data/types';
import { ciede2000FromHex } from './ciede2000';
import { euclideanRgbDistance } from './colorSpace';

const BACKGROUND_COLORS = ['#FFFFFF', '#F5F5F5', '#FAFAFA', '#F0F0F0', '#FEFEFE'];

export function detectDirtyData(
  works: Work[],
  swatches: ColorSwatch[]
): DirtyDataAlert[] {
  const alerts: DirtyDataAlert[] = [];
  let alertIdx = 0;

  const sameNameAlerts = detectSameColorDifferentName(swatches);
  for (const a of sameNameAlerts) {
    a.id = `alert-${alertIdx++}`;
    alerts.push(a);
  }

  const bgAlerts = detectBackgroundContamination(swatches);
  for (const a of bgAlerts) {
    a.id = `alert-${alertIdx++}`;
    alerts.push(a);
  }

  const scaleAlerts = detectDistanceScaleErrors(swatches);
  for (const a of scaleAlerts) {
    a.id = `alert-${alertIdx++}`;
    alerts.push(a);
  }

  return alerts;
}

function detectSameColorDifferentName(swatches: ColorSwatch[]): DirtyDataAlert[] {
  const alerts: DirtyDataAlert[] = [];
  const hexMap = new Map<string, ColorSwatch[]>();

  for (const s of swatches) {
    const upper = s.hex.toUpperCase();
    if (!hexMap.has(upper)) hexMap.set(upper, []);
    hexMap.get(upper)!.push(s);
  }

  for (const [hex, group] of hexMap) {
    const names = new Set(group.map(s => s.colorName));
    if (names.size > 1) {
      const nameList = Array.from(names).join(' / ');
      for (const s of group) {
        alerts.push({
          id: '',
          workId: s.workId,
          colorId: s.id,
          issueType: 'same_color_different_name',
          description: `色值 ${hex} 被命名为多个不同名称：${nameList}`,
          suggestion: `统一命名，建议选择最具描述性的名称`,
          severity: 'warning',
          resolved: false,
        });
      }
    }
  }

  return alerts;
}

function detectBackgroundContamination(swatches: ColorSwatch[]): DirtyDataAlert[] {
  const alerts: DirtyDataAlert[] = [];

  for (const s of swatches) {
    if (s.isBackground) {
      alerts.push({
        id: '',
        workId: s.workId,
        colorId: s.id,
        issueType: 'background_contamination',
        description: `色块 "${s.colorName}" (${s.hex}) 被标记为背景色，不应纳入配色分析`,
        suggestion: `将此色块从配色分析中排除，或取消背景色标记`,
        severity: 'info',
        resolved: false,
      });
      continue;
    }

    for (const bgHex of BACKGROUND_COLORS) {
      const dist = ciede2000FromHex(s.hex, bgHex);
      if (dist < 3) {
        alerts.push({
          id: '',
          workId: s.workId,
          colorId: s.id,
          issueType: 'background_contamination',
          description: `色块 "${s.colorName}" (${s.hex}) 与背景色 ${bgHex} 过近 (ΔE=${dist.toFixed(1)})，疑似背景色混入`,
          suggestion: `确认是否为背景色，若是则标记排除`,
          severity: 'critical',
          resolved: false,
        });
        break;
      }
    }
  }

  return alerts;
}

function detectDistanceScaleErrors(swatches: ColorSwatch[]): DirtyDataAlert[] {
  const alerts: DirtyDataAlert[] = [];
  const checked = new Set<string>();

  for (let i = 0; i < swatches.length; i++) {
    for (let j = i + 1; j < swatches.length; j++) {
      if (swatches[i].workId !== swatches[j].workId) continue;

      const key = [swatches[i].id, swatches[j].id].sort().join('-');
      if (checked.has(key)) continue;
      checked.add(key);

      const eucDist = euclideanRgbDistance(swatches[i].hex, swatches[j].hex);
      const percDist = ciede2000FromHex(swatches[i].hex, swatches[j].hex);

      if (percDist < 0.01) continue;

      const ratio = eucDist / percDist;

      if (ratio > 2.5 || ratio < 0.4) {
        const direction = ratio > 2.5 ? '偏大' : '偏小';
        alerts.push({
          id: '',
          workId: swatches[i].workId,
          colorId: swatches[i].id,
          issueType: 'distance_scale_error',
          description: `"${swatches[i].colorName}"与"${swatches[j].colorName}"之间RGB欧氏距离(${eucDist.toFixed(1)})与CIEDE2000(${percDist.toFixed(1)})比值${direction}(${ratio.toFixed(2)})，距离尺度不一致`,
          suggestion: `检查颜色采集是否准确，可能存在色彩空间转换误差或色值记录错误`,
          severity: 'warning',
          resolved: false,
        });
      }
    }
  }

  return alerts;
}
