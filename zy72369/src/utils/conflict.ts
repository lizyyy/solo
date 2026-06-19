import type { Nameplate, BendLossRecord, ScreenshotAttachment, ConflictEntry } from '@/types';
import { genId } from './id';

export function detectConflicts(
  nameplate: Nameplate,
  records: BendLossRecord[],
  screenshots: ScreenshotAttachment[]
): ConflictEntry[] {
  const conflicts: ConflictEntry[] = [];

  for (const record of records) {
    if (record.nameplateId !== nameplate.id) continue;
    const relatedScreenshots = screenshots.filter(s => s.recordId === record.id);
    for (const ss of relatedScreenshots) {
      const ssLower = ss.note.toLowerCase();
      if (ssLower.includes('最小弯曲半径') || ssLower.includes('minbendradius') || ssLower.includes('弯曲半径')) {
        const radiusMatch = ssLower.match(/(\d+\.?\d*)\s*(mm|毫米)/);
        if (radiusMatch) {
          const ssRadius = parseFloat(radiusMatch[1]);
          if (ssRadius !== nameplate.minBendRadius) {
            conflicts.push({
              id: genId(),
              recordId: record.id,
              screenshotId: ss.id,
              nameplateValue: `最小弯曲半径: ${nameplate.minBendRadius}mm`,
              screenshotValue: `最小弯曲半径: ${ssRadius}mm`,
              nameplateEvidence: `铭牌基准值 ${nameplate.minBendRadius}mm (导入时间: ${nameplate.importTime})`,
              screenshotEvidence: `截图备注 "${ss.note}" (上传时间: ${ss.uploadTime})`,
              status: 'pending',
            });
          }
        }
      }
      const npType = nameplate.fiberType;
      if (ssLower.includes('光纤类型') || ssLower.includes('fibertype') || ssLower.includes('光纤型号')) {
        if (!ssLower.includes(npType.toLowerCase())) {
          conflicts.push({
            id: genId(),
            recordId: record.id,
            screenshotId: ss.id,
            nameplateValue: `光纤类型: ${nameplate.fiberType}`,
            screenshotValue: `截图提及光纤类型与铭牌不一致`,
            nameplateEvidence: `铭牌值 "${nameplate.fiberType}" (导入时间: ${nameplate.importTime})`,
            screenshotEvidence: `截图备注 "${ss.note}" (上传时间: ${ss.uploadTime})`,
            status: 'pending',
          });
        }
      }
      if (ssLower.includes('芯径') || ssLower.includes('core') || ssLower.includes('直径')) {
        const diameterMatch = ssLower.match(/(\d+\.?\d*)\s*(μm|um|微米)/);
        if (diameterMatch) {
          const ssDiameter = parseFloat(diameterMatch[1]);
          if (ssDiameter !== nameplate.coreDiameter) {
            conflicts.push({
              id: genId(),
              recordId: record.id,
              screenshotId: ss.id,
              nameplateValue: `芯径: ${nameplate.coreDiameter}μm`,
              screenshotValue: `芯径: ${ssDiameter}μm`,
              nameplateEvidence: `铭牌基准值 ${nameplate.coreDiameter}μm (导入时间: ${nameplate.importTime})`,
              screenshotEvidence: `截图备注 "${ss.note}" (上传时间: ${ss.uploadTime})`,
              status: 'pending',
            });
          }
        }
      }
    }
  }

  return conflicts;
}
